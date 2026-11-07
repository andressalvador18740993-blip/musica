// --- CONFIGURACIÓN DE POCKETBASE ---
const PB_URL = "https://pocketbase-railway-production-e2c8.up.railway.app"; 
const pb = new PocketBase(PB_URL);

let currentSongsList = [];
let currentIndex = 0;
let isRegistering = false;

document.addEventListener("DOMContentLoaded", () => {
    if (pb.authStore.isValid) {
        showApp();
    } else {
        showAuth();
    }
});

// --- AUTENTICACIÓN ---
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
        alert("Verifica tus datos o conexión.");
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
    loadPlaylists();
}

// --- NAVEGACIÓN ---
function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.remove("bg-emerald-500", "text-zinc-950");
        btn.classList.add("bg-zinc-900", "text-zinc-300", "border", "border-zinc-800");
    });

    document.getElementById(`tab-${tabName}`).classList.remove("hidden");
    event.currentTarget.classList.remove("bg-zinc-900", "text-zinc-300", "border", "border-zinc-800");
    event.currentTarget.classList.add("bg-emerald-500", "text-zinc-950");
}

// --- BIBLIOTECA Y REPRODUCTOR CON SECUENCIA ---
async function loadSongs() {
    const songsListContainer = document.getElementById("songs-list");
    try {
        const records = await pb.collection('songs').getList(1, 30, { sort: '-created' });
        currentSongsList = records.items;

        if (currentSongsList.length === 0) {
            songsListContainer.innerHTML = `<p class="text-zinc-500 text-center py-6">No hay canciones subidas aún.</p>`;
            return;
        }

        songsListContainer.innerHTML = "";
        currentSongsList.forEach((song, index) => {
            const coverUrl = song.cover ? pb.files.getUrl(song, song.cover) : null;
            const songElement = document.createElement("div");
            songElement.className = "flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800 hover:border-zinc-700 transition";
            songElement.innerHTML = `
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center text-zinc-500">
                        ${coverUrl ? `<img src="${coverUrl}" class="w-full h-full object-cover">` : '<i class="fa-solid fa-music"></i>'}
                    </div>
                    <div class="truncate">
                        <h4 class="text-sm font-semibold text-zinc-100 truncate">${song.title}</h4>
                        <p class="text-xs text-zinc-400 truncate">${song.artist}</p>
                    </div>
                </div>
                <button onclick="playSongByIndex(${index})" class="w-10 h-10 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 rounded-full flex items-center justify-center transition flex-shrink-0">
                    <i class="fa-solid fa-play ml-0.5"></i>
                </button>
            `;
            songsListContainer.appendChild(songElement);
        });
    } catch (error) {
        console.error("Error al cargar canciones:", error);
    }
}

function playSongByIndex(index) {
    if (index < 0 || index >= currentSongsList.length) return;
    currentIndex = index;
    const song = currentSongsList[currentIndex];
    const audioUrl = pb.files.getUrl(song, song.audio_file);

    document.getElementById("audio-player-bar").classList.remove("hidden");
    document.getElementById("player-title").textContent = song.title;
    document.getElementById("player-artist").textContent = song.artist;

    const audioEl = document.getElementById("main-audio-element");
    audioEl.src = audioUrl;
    audioEl.play();
    document.getElementById("play-pause-btn").innerHTML = `<i class="fa-solid fa-pause text-sm"></i>`;
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
    currentIndex = (currentIndex + 1) % currentSongsList.length;
    playSongByIndex(currentIndex);
}

function prevSong() {
    if (currentSongsList.length === 0) return;
    currentIndex = (currentIndex - 1 + currentSongsList.length) % currentSongsList.length;
    playSongByIndex(currentIndex);
}

// --- SUBIR MÚSICA ---
const uploadForm = document.getElementById("upload-form");
uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append("title", document.getElementById("song-title").value);
    formData.append("artist", document.getElementById("song-artist").value);
    formData.append("audio_file", document.getElementById("song-file").files[0]);
    const cover = document.getElementById("song-cover").files[0];
    if (cover) formData.append("cover", cover);
    formData.append("uploaded_by", pb.authStore.model.id);

    try {
        alert("Subiendo canción...");
        await pb.collection('songs').create(formData);
        alert("¡Subida con éxito!");
        uploadForm.reset();
        switchTab('songs');
        loadSongs();
    } catch (error) {
        alert("Error al subir archivo.");
    }
});

// --- PLAYLISTS PERSONALIZADAS ---
async function createPlaylist() {
    const name = document.getElementById("playlist-name-input").value;
    if (!name) return;
    try {
        await pb.collection('playlists').create({
            name: name,
            owner: pb.authStore.model.id
        });
        document.getElementById("playlist-name-input").value = "";
        loadPlaylists();
    } catch (error) {
        alert("Error al crear playlist.");
    }
}

async function loadPlaylists() {
    const container = document.getElementById("playlists-container");
    try {
        const records = await pb.collection('playlists').getList(1, 20, { sort: '-created' });
        if (records.items.length === 0) {
            container.innerHTML = `<p class="text-zinc-500 text-center py-4 text-xs">No tienes playlists creadas.</p>`;
            return;
        }
        container.innerHTML = "";
        records.items.forEach(pl => {
            const div = document.createElement("div");
            div.className = "bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl flex items-center justify-between";
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-lg flex items-center justify-center">
                        <i class="fa-solid fa-list-music"></i>
                    </div>
                    <span class="text-sm font-semibold text-white">${pl.name}</span>
                </div>
                <span class="text-xs text-zinc-500">Personalizada</span>
            `;
            container.appendChild(div);
        });
    } catch (error) {
        console.error("Error cargando playlists", error);
    }
}

// --- JAM ---
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
