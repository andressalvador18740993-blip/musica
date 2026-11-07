// --- CONFIGURACIÓN DE POCKETBASE ---
const PB_URL = "https://pocketbase-railway-production-e2c8.up.railway.app"; 
const pb = new PocketBase(PB_URL);

// Referencias a elementos del DOM
const authContainer = document.getElementById("auth-container");
const appContainer = document.getElementById("app-container");
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authBtn = document.getElementById("auth-btn");
const authSwitchText = document.getElementById("auth-switch-text");
const authSwitchBtn = document.getElementById("auth-switch-btn");
const userDisplay = document.getElementById("user-display");

let isRegistering = false;

// Comprobar si ya hay una sesión activa al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    if (pb.authStore.isValid) {
        showApp();
    } else {
        showAuth();
    }
});

// --- LÓGICA DE AUTENTICACIÓN ---

function toggleAuthMode() {
    isRegistering = !isRegistering;
    if (isRegistering) {
        authTitle.textContent = "Crear Cuenta";
        authBtn.textContent = "Registrarse";
        authSwitchText.textContent = "¿Ya tienes cuenta?";
        authSwitchBtn.textContent = "Inicia sesión";
    } else {
        authTitle.textContent = "Iniciar Sesión";
        authBtn.textContent = "Entrar";
        authSwitchText.textContent = "¿No tienes cuenta?";
        authSwitchBtn.textContent = "Regístrate";
    }
}

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    try {
        if (isRegistering) {
            // Registrar usuario
            await pb.collection('users').create({
                email: email,
                password: password,
                passwordConfirm: password,
            });
            // Auto login tras registro
            await pb.collection('users').authWithPassword(email, password);
            alert("¡Cuenta creada con éxito!");
        } else {
            // Iniciar sesión
            await pb.collection('users').authWithPassword(email, password);
        }
        showApp();
    } catch (error) {
        console.error("Error de autenticación:", error);
        alert("Hubo un error. Verifica tus datos o que PocketBase esté en línea.");
    }
});

function logout() {
    pb.authStore.clear();
    showAuth();
}

function showAuth() {
    authContainer.classList.remove("hidden");
    appContainer.classList.add("hidden");
}

function showApp() {
    authContainer.classList.add("hidden");
    appContainer.classList.remove("hidden");
    userDisplay.textContent = pb.authStore.model.email;
    loadSongs(); // Cargar la biblioteca al entrar
}

// --- NAVEGACIÓN ENTRE PESTAÑAS ---

function switchTab(tabName) {
    // Ocultar todo el contenido
    document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
    // Desactivar botones
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.classList.remove("bg-emerald-500", "text-zinc-950", "active-tab");
        btn.classList.add("bg-zinc-900", "text-zinc-300", "border", "border-zinc-800");
    });

    // Mostrar la pestaña seleccionada
    document.getElementById(`tab-${tabName}`).classList.remove("hidden");
    
    // Activar el botón correspondiente
    event.currentTarget.classList.remove("bg-zinc-900", "text-zinc-300", "border", "border-zinc-800");
    event.currentTarget.classList.add("bg-emerald-500", "text-zinc-950");
}

// --- GESTIÓN DE CANCIONES Y REPRODUCTOR ---

async function loadSongs() {
    const songsListContainer = document.getElementById("songs-list");
    try {
        // Obtener canciones de PocketBase ordenadas por fecha de creación
        const records = await pb.collection('songs').getList(1, 50, {
            sort: '-created',
        });

        if (records.items.length === 0) {
            songsListContainer.innerHTML = `<p class="text-zinc-500 text-center py-6">No hay canciones subidas aún.</p>`;
            return;
        }

        songsListContainer.innerHTML = "";
        records.items.forEach(song => {
            // Obtener la URL del archivo de audio usando el helper de PocketBase
            const audioUrl = pb.files.getUrl(song, song.audio_file);
            const coverUrl = song.cover ? pb.files.getUrl(song, song.cover) : null;

            const songElement = document.createElement("div");
            songElement.className = "flex items-center justify-between bg-zinc-900 p-3 rounded-xl border border-zinc-800 hover:border-zinc-700 transition";
            songElement.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-zinc-800 rounded-lg overflow-hidden flex items-center justify-center text-zinc-500">
                        ${coverUrl ? `<img src="${coverUrl}" class="w-full h-full object-cover">` : '<i class="fa-solid fa-music"></i>'}
                    </div>
                    <div>
                        <h4 class="text-sm font-semibold text-zinc-100">${song.title}</h4>
                        <p class="text-xs text-zinc-400">${song.artist}</p>
                    </div>
                </div>
                <button onclick="playSong('${audioUrl}', '${song.title}', '${song.artist}')" class="w-10 h-10 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-zinc-950 rounded-full flex items-center justify-center transition">
                    <i class="fa-solid fa-play ml-0.5"></i>
                </button>
            `;
            songsListContainer.appendChild(songElement);
        });
    } catch (error) {
        console.error("Error al cargar canciones:", error);
        songsListContainer.innerHTML = `<p class="text-red-400 text-center py-6">Error al conectar con la base de datos.</p>`;
    }
}

// Subir música
const uploadForm = document.getElementById("upload-form");
uploadForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("song-title").value;
    const artist = document.getElementById("song-artist").value;
    const audioFile = document.getElementById("song-file").files[0];
    const coverFile = document.getElementById("song-cover").files[0];

    const formData = new FormData();
    formData.append("title", title);
    formData.append("artist", artist);
    formData.append("audio_file", audioFile);
    if (coverFile) {
        formData.append("cover", coverFile);
    }
    formData.append("uploaded_by", pb.authStore.model.id);

    try {
        alert("Subiendo canción a la nube... Por favor espera.");
        await pb.collection('songs').create(formData);
        alert("¡Canción subida con éxito!");
        uploadForm.reset();
        switchTab('songs'); // Volver a la biblioteca
        loadSongs();
    } catch (error) {
        console.error("Error al subir la canción:", error);
        alert("Hubo un error al subir el archivo.");
    }
});

// Reproductor básico inferior
const audioPlayerBar = document.getElementById("audio-player-bar");
const mainAudioElement = document.getElementById("main-audio-element");
const playerTitle = document.getElementById("player-title");
const playerArtist = document.getElementById("player-artist");
const playPauseBtn = document.getElementById("play-pause-btn");

function playSong(url, title, artist) {
    audioPlayerBar.classList.remove("hidden");
    playerTitle.textContent = title;
    playerArtist.textContent = artist;
    
    mainAudioElement.src = url;
    mainAudioElement.play();
    playPauseBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
}

function togglePlay() {
    if (mainAudioElement.paused) {
        mainAudioElement.play();
        playPauseBtn.innerHTML = `<i class="fa-solid fa-pause"></i>`;
    } else {
        mainAudioElement.pause();
        playPauseBtn.innerHTML = `<i class="fa-solid fa-play"></i>`;
    }
}

// Simulación de creación de Jam
function createJamRoom() {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const statusDiv = document.getElementById("jam-status");
    statusDiv.classList.remove("hidden");
    statusDiv.innerHTML = `Sala creada con éxito. Tu código es: <strong class="text-emerald-400 text-lg">${code}</strong>. (Sincronización en tiempo real lista para conectar).`;
}

function joinJamRoom() {
    const code = document.getElementById("room-code-input").value;
    if (!code) {
        alert("Introduce un código de sala válido.");
        return;
    }
    const statusDiv = document.getElementById("jam-status");
    statusDiv.classList.remove("hidden");
    statusDiv.innerHTML = `Te has unido a la sala <strong class="text-emerald-400">${code.toUpperCase()}</strong>.`;
}
