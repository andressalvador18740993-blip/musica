const PB_URL = "https://pocketbase-railway-production-e2c8.up.railway.app"; 
const pb = new PocketBase(PB_URL);

let currentSongsList = [];
let currentIndex = 0;
let isRegistering = false;
let isShuffleActive = false;
const CACHE_NAME = "salvamusic-offline-v5";

document.addEventListener("DOMContentLoaded", () => {
    if (pb.authStore.isValid) {
        showApp();
    } else {
        showAuth();
    }
    updateOfflineCount();
    loadCustomPlaylists();
});

function toggleAuthMode() {
    isRegistering = !isRegistering;
    if (isRegistering) {
        document.getElementById("auth-title").textContent = "Crear Cuenta";
        document.getElementById("auth-btn").textContent = "Registrarse";
        document.getElementById("auth-switch-text").textContent = "¿Ya tienes cuenta?";
        document.getElementById("auth-switch-btn").textContent = "Inicia sesión";
    } else {
        document.getElementById("auth-title").textContent = "Iniciar Sesión";
        document.getElementById("auth-btn").textContent = "Entrar";
        document.getElementById("auth-switch-text").textContent = "¿No tienes cuenta?";
        document.getElementById("auth-switch-btn").textContent = "Regístrate";
    }
}

document.getElementById("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        if (isRegistering) {
            await pb.collection('users').create({ email, password, passwordConfirm: password });
            await pb.collection('users').authWithPassword(email, password);
            alert("¡Cuenta creada con éxito!");
        } else {
            await pb.collection('users').authWithPassword(email, password);
        }
        showApp();
    } catch (error) {
        console.error("Error de autenticación:", error);
        alert("Correo o contraseña incorrectos. Verifica tus datos.");
    }
});

function logout() {
    pb.authStore.clear();
    showAuth();
}

function showAuth() {
    document.getElementById("auth-container").classList.remove("hidden");
    document.getElementById("app-container").classList.add("hidden");
    document.getElementById("audio-player-bar").classList.add("hidden");
}

function showApp() {
    document.getElementById("auth-container").classList.add("hidden");
    document.getElementById("app-container").classList.remove("hidden");
    document.getElementById("user-display").textContent = pb.authStore.model.email;
    loadSongs();
}

function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.remove("bg-emerald-500", "text-zinc-950");
        btn.classList.add("bg-zinc-900", "text-zinc-300", "border", "border-zinc-800");
    });
    document.getElementById(`tab-${tabName}`).classList.remove("hidden");
    event.currentTarget.classList.remove("bg-zinc-900", "text-zinc-300", "border", "border-zinc-800");
    event.currentTarget.classList.add("bg-emerald-500", "text-zinc-950");

    if (tabName === 'playlists') {
        loadCustomPlaylists();
    }
}

async function loadSongs() {
    const songsListContainer = document.getElementById("songs-list");
    try {
        const userId = pb.authStore.model.id;
        const records = await pb.collection('songs').getList(1, 50, {
            filter: `uploaded_by = "${userId}"`,
            sort: '-created',
        });
        currentSongsList = records.items;

        if (currentSongsList.length === 0) {
            songsListContainer.innerHTML = `<p class="text-zinc-500 text-center py-6 text-xs">Tu biblioteca personal está vacía. Sube tu música.</p>`;
            return;
        }

        renderSongsList(currentSongsList);
    } catch (error) {
        console.error("Error al cargar canciones:", error);
    }
}

function renderSongsList(songs) {
    const songsListContainer = document.getElementById("songs-list");
    
    let htmlContent = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-xs text-zinc-400">${songs.length} canciones</span>
        </div>
    `;

    songs.forEach((song, index) => {
        const coverUrl = song.cover ? pb.files.getUrl(song, song.cover) : null;
        const audioUrl = pb.files.getUrl(song, song.audio_file);

        htmlContent += `
            <div class="flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800 hover:border-zinc-700 transition">
                <div class="flex items-center gap-3 overflow-hidden cursor-pointer flex-grow" onclick="playSongByIndex(${index})">
                    <div class="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-zinc-500">
                        ${coverUrl ? `<img src="${coverUrl}" class="w-full h-full object-cover">` : '<i class="fa-solid fa-music"></i>'}
                    </div>
                    <div class="truncate">
                        <h4 class="text-sm font-semibold text-zinc-100 truncate">${song.title}</h4>
                        <p class="text-xs text-zinc-400 truncate">${song.artist}</p>
                    </div>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                    <button onclick="toggleDownloadOffline('${audioUrl}', '${song.title}')" class="w-9 h-9 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-full flex items-center justify-center transition" title="Guardar offline">
                        <i class="fa-solid fa-cloud-arrow-down text-xs"></i>
                    </button>
                    <button onclick="playSongByIndex(${index})" class="w-9 h-9 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 rounded-full flex items-center justify-center transition" title="Reproducir">
                        <i class="fa-solid fa-play text-xs ml-0.5"></i>
                    </button>
                    <button onclick="deleteSong('${song.id}', '${song.title}')" class="w-9 h-9 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-full flex items-center justify-center transition" title="Eliminar canción">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                </div>
            </div>
        `;
    });

    songsListContainer.innerHTML = htmlContent;
}

// --- GESTIÓN DE PLAYLISTS PERSONALIZADAS ---

function openCreatePlaylistModal() {
    const modal = document.getElementById("create-playlist-modal");
    if (!modal) {
        alert("Error: El modal de playlist no se encontró en el HTML.");
        return;
    }

    document.getElementById("playlist-name-input").value = "";
    const container = document.getElementById("playlist-selectable-songs");
    
    if (!currentSongsList || currentSongsList.length === 0) {
        container.innerHTML = `<p class="text-zinc-500 text-center py-4 text-xs">No hay canciones en tu biblioteca para agregar.</p>`;
    } else {
        container.innerHTML = "";
        currentSongsList.forEach((song) => {
            container.innerHTML += `
                <label class="flex items-center justify-between bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 cursor-pointer hover:border-emerald-500 transition">
                    <div class="truncate flex items-center gap-2">
                        <input type="checkbox" value="${song.id}" class="playlist-song-checkbox w-4 h-4 accent-emerald-500 rounded">
                        <div class="truncate">
                            <p class="text-xs font-semibold text-white truncate">${song.title}</p>
                            <p class="text-[10px] text-zinc-400 truncate">${song.artist}</p>
                        </div>
                    </div>
                </label>
            `;
        });
    }
    modal.classList.remove("hidden");
}

function closeCreatePlaylistModal() {
    document.getElementById("create-playlist-modal").classList.add("hidden");
}

function saveNewPlaylist() {
    const name = document.getElementById("playlist-name-input").value.trim();
    if (!name) {
        alert("Por favor ingresa un nombre para la playlist.");
        return;
    }

    const checkboxes = document.querySelectorAll(".playlist-song-checkbox:checked");
    const selectedSongIds = Array.from(checkboxes).map(cb => cb.value);

    if (selectedSongIds.length === 0) {
        alert("Selecciona al menos una canción para la playlist.");
        return;
    }

    let playlists = JSON.parse(localStorage.getItem('salva_playlists') || '[]');
    playlists.push({
        id: 'pl_' + Date.now(),
        name: name,
        songIds: selectedSongIds
    });

    localStorage.setItem('salva_playlists', JSON.stringify(playlists));
    alert(`¡Playlist "${name}" creada con éxito!`);
    closeCreatePlaylistModal();
    loadCustomPlaylists();
}

function loadCustomPlaylists() {
    const container = document.getElementById("custom-playlists-container");
    if (!container) return;
    const playlists = JSON.parse(localStorage.getItem('salva_playlists') || '[]');

    if (playlists.length === 0) {
        container.innerHTML = `<p class="text-zinc-600 text-center py-2 text-xs">No tienes playlists personalizadas creadas.</p>`;
        return;
    }

    container.innerHTML = "";
    playlists.forEach(pl => {
        container.innerHTML += `
            <div class="bg-zinc-900 border border-zinc-800 hover:border-emerald-500 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition" onclick="openPlaylistDetail('${pl.id}')">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center text-lg">
                        <i class="fa-solid fa-list-music"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-white">${pl.name}</h3>
                        <p class="text-xs text-zinc-400">${pl.songIds.length} canciones</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="event.stopPropagation(); deletePlaylist('${pl.id}')" class="text-zinc-500 hover:text-red-400 p-2" title="Eliminar playlist">
                        <i class="fa-solid fa-trash text-xs"></i>
                    </button>
                    <i class="fa-solid fa-chevron-right text-zinc-500"></i>
                </div>
            </div>
        `;
    });
}

function openPlaylistDetail(playlistId) {
    const playlists = JSON.parse(localStorage.getItem('salva_playlists') || '[]');
    const pl = playlists.find(p => p.id === playlistId);
    if (!pl) return;

    document.getElementById("view-playlist-title").textContent = pl.name;
    const container = document.getElementById("view-playlist-songs");
    container.innerHTML = "";

    const songsInPl = currentSongsList.filter(s => pl.songIds.includes(s.id));

    if (songsInPl.length === 0) {
        container.innerHTML = `<p class="text-zinc-500 text-center py-4 text-xs">Esta playlist no tiene canciones disponibles.</p>`;
    } else {
        songsInPl.forEach((song) => {
            const audioUrl = pb.files.getUrl(song, song.audio_file);
            container.innerHTML += `
                <div class="flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                    <div class="truncate">
                        <h4 class="text-sm font-semibold text-white truncate">${song.title}</h4>
                        <p class="text-xs text-zinc-400 truncate">${song.artist}</p>
                    </div>
                    <button onclick="playSongUrl('${audioUrl}', '${song.title}', '${song.artist}')" class="w-9 h-9 bg-emerald-500 text-zinc-950 rounded-full flex items-center justify-center">
                        <i class="fa-solid fa-play text-xs ml-0.5"></i>
                    </button>
                </div>
            `;
        });
    }

    document.getElementById("view-playlist-modal").classList.remove("hidden");
}

function closeViewPlaylistModal() {
    document.getElementById("view-playlist-modal").classList.add("hidden");
}

function deletePlaylist(playlistId) {
    if (!confirm("¿Estás seguro de eliminar esta playlist?")) return;
    let playlists = JSON.parse(localStorage.getItem('salva_playlists') || '[]');
    playlists = playlists.filter(p => p.id !== playlistId);
    localStorage.setItem('salva_playlists', JSON.stringify(playlists));
    loadCustomPlaylists();
}

// --- FIN PLAYLISTS ---

function toggleShuffle() {
    isShuffleActive = !isShuffleActive;
    const shuffleBtn = document.getElementById("shuffle-btn");
    
    if (isShuffleActive) {
        shuffleBtn.classList.remove("text-zinc-400");
        shuffleBtn.classList.add("text-emerald-400", "scale-110");
        alert("Modo aleatorio activado");
    } else {
        shuffleBtn.classList.remove("text-emerald-400", "scale-110");
        shuffleBtn.classList.add("text-zinc-400");
        alert("Modo aleatorio desactivado");
    }
}

async function deleteSong(songId, songTitle) {
    if (!confirm(`¿Estás seguro de que deseas eliminar "${songTitle}" de tu biblioteca?`)) return;

    try {
        await pb.collection('songs').delete(songId);
        alert(`¡"${songTitle}" ha sido eliminada con éxito!`);
        loadSongs();
    } catch (error) {
        console.error("Error al eliminar la canción:", error);
        alert("No se pudo eliminar la canción.");
    }
}

async function toggleDownloadOffline(url, title) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await fetch(url);
        if (response.ok) {
            await cache.put(url, response);
            alert(`¡"${title}" guardada en la caché offline de tu dispositivo!`);
            updateOfflineCount();
        } else {
            alert("No se pudo descargar el archivo.");
        }
    } catch (error) {
        alert("Error de red al intentar guardar la canción.");
    }
}

async function updateOfflineCount() {
    try {
        if (!('caches' in window)) return;
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();
        document.getElementById("offline-count").textContent = keys.length;
    } catch (e) {}
}

async function openOfflinePlaylist() {
    const modal = document.getElementById("offline-modal");
    const container = document.getElementById("offline-songs-list");
    modal.classList.remove("hidden");
    container.innerHTML = `<p class="text-zinc-500 text-center py-4 text-xs">Cargando canciones...</p>`;

    try {
        const cache = await caches.open(CACHE_NAME);
        const requests = await cache.keys();
        if (requests.length === 0) {
            container.innerHTML = `<p class="text-zinc-500 text-center py-6 text-xs">No tienes canciones descargadas.</p>`;
            return;
        }

        container.innerHTML = "";
        requests.forEach((req, idx) => {
            const songUrl = req.url;
            const matchedSong = currentSongsList.find(s => pb.files.getUrl(s, s.audio_file) === songUrl) || { title: `Canción Offline ${idx+1}`, artist: 'Local' };
            const div = document.createElement("div");
            div.className = "flex items-center justify-between bg-zinc-950 p-3 rounded-xl border border-zinc-800";
            div.innerHTML = `
                <div class="truncate">
                    <h4 class="text-sm font-semibold text-white truncate">${matchedSong.title}</h4>
                    <p class="text-xs text-emerald-400">Offline</p>
                </div>
                <button onclick="playSongUrl('${songUrl}', '${matchedSong.title}', '${matchedSong.artist}')" class="w-9 h-9 bg-emerald-500 text-zinc-950 rounded-full flex items-center justify-center">
                    <i class="fa-solid fa-play text-xs ml-0.5"></i>
                </button>
            `;
            container.appendChild(div);
        });
    } catch (e) {
        container.innerHTML = `<p class="text-red-400 text-center py-4 text-xs">Error al leer almacenamiento.</p>`;
    }
}

function closeOfflinePlaylist() {
    document.getElementById("offline-modal").classList.add("hidden");
}

function playSongUrl(url, title, artist) {
    document.getElementById("audio-player-bar").classList.remove("hidden");
    document.getElementById("player-title").textContent = title;
    document.getElementById("player-artist").textContent = artist;
    const audioEl = document.getElementById("main-audio-element");
    audioEl.src = url;
    audioEl.play();
    document.getElementById("play-pause-btn").innerHTML = `<i class="fa-solid fa-pause text-sm"></i>`;
}

function playSongByIndex(index) {
    if (index < 0 || index >= currentSongsList.length) return;
    currentIndex = index;
    const song = currentSongsList[currentIndex];
    const audioUrl = pb.files.getUrl(song, song.audio_file);
    playSongUrl(audioUrl, song.title, song.artist);
}

function togglePlay() {
    const audioEl = document.getElementById("main-audio-element");
    if (audioEl.paused) {
        audioEl.play();
        document.getElementById("play-pause-btn").innerHTML = `<i class="fa-solid fa-pause text-sm"></i>`;
    } else {
        audioEl.pause();
        document.getElementById("play-pause-btn").innerHTML = `<i class="fa-solid fa-play text-sm ml-0.5"></i>`;
    }
}

function nextSong() {
    if (currentSongsList.length === 0) return;
    if (isShuffleActive) {
        currentIndex = Math.floor(Math.random() * currentSongsList.length);
    } else {
        currentIndex = (currentIndex + 1) % currentSongsList.length;
    }
    playSongByIndex(currentIndex);
}

function prevSong() {
    if (currentSongsList.length === 0) return;
    currentIndex = (currentIndex - 1 + currentSongsList.length) % currentSongsList.length;
    playSongByIndex(currentIndex);
}

function openLyrics() {
    if (currentSongsList.length === 0) return;
    const song = currentSongsList[currentIndex];
    document.getElementById("lyrics-song-title").textContent = `${song.title} - ${song.artist}`;
    document.getElementById("lyrics-content").textContent = song.lyrics || "Esta canción no tiene letra registrada.";
    document.getElementById("lyrics-modal").classList.remove("hidden");
}

function closeLyrics() {
    document.getElementById("lyrics-modal").classList.add("hidden");
}

const uploadForm = document.getElementById("upload-form");
uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleInput = document.getElementById("song-title").value.trim();
    const artistInput = document.getElementById("song-artist").value.trim();
    const userId = pb.authStore.model.id;

    try {
        const checkDuplicate = await pb.collection('songs').getList(1, 1, {
            filter: `uploaded_by = "${userId}" && title = "${titleInput}" && artist = "${artistInput}"`
        });

        if (checkDuplicate.totalItems > 0) {
            alert(`Error: Ya tienes registrada la canción "${titleInput}" de "${artistInput}".`);
            return;
        }

        const formData = new FormData();
        formData.append("title", titleInput);
        formData.append("artist", artistInput);
        formData.append("lyrics", document.getElementById("song-lyrics").value);
        formData.append("audio_file", document.getElementById("song-file").files[0]);
        const cover = document.getElementById("song-cover").files[0];
        if (cover) formData.append("cover", cover);
        formData.append("uploaded_by", userId);

        alert("Subiendo canción a tu biblioteca...");
        await pb.collection('songs').create(formData);
        alert("¡Subida con éxito!");
        uploadForm.reset();
        switchTab('songs');
        loadSongs();
    } catch (error) {
        console.error("Error al subir archivo:", error);
        alert("Error al verificar o subir el archivo.");
    }
});

function createJamRoom() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const statusDiv = document.getElementById("jam-status");
    statusDiv.classList.remove("hidden");
    statusDiv.innerHTML = `Sala Jam creada. Código: <strong class="text-emerald-400 text-base">${code}</strong>`;
}

function joinJamRoom() {
    const code = document.getElementById("room-code-input").value;
    if (!code) return;
    const statusDiv = document.getElementById("jam-status");
    statusDiv.classList.remove("hidden");
    statusDiv.innerHTML = `Conectado a la sala Jam: <strong class="text-emerald-400">${code.toUpperCase()}</strong>`;
}
