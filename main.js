const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

let camera = null;
let lastLandmarks = null; // último rostro detectado

// Inicializar FaceMesh
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

function resizeCanvasToVideo(){
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
}

async function onResults(results){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(results.multiFaceLandmarks && results.multiFaceLandmarks.length){
    const landmarks = results.multiFaceLandmarks[0];
    lastLandmarks = landmarks; // guardamos rostro actual

    // Dibujar malla
    drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {lineWidth:1, color:'#00FF00'});
    drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYE, {lineWidth:2, color:'#FF0000'});
    drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYE, {lineWidth:2, color:'#0000FF'});
    drawConnectors(ctx, landmarks, FACEMESH_LIPS, {lineWidth:2, color:'#FFFF00'});
    }
}

async function startCamera(){
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width:640, height:480 }, audio:false });
    video.srcObject = stream;
    await video.play();
    resizeCanvasToVideo();

    camera = new Camera(video, {
    onFrame: async () => {
        await faceMesh.send({image: video});
    },
    width: video.videoWidth,
    height: video.videoHeight
    });
    camera.start();
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await initIndexedDB();
        console.log("IndexedDB inicializado correctamente");
        await startCamera();
    } catch (err) {
        console.error("Error en la inicialización:", err);
        alert("Error accediendo a la cámara: " + err.message);
    }
})

window.addEventListener('resize', () => { if(video.videoWidth) resizeCanvasToVideo(); });

// -------------------------------
// Configuración de IndexedDB
// -------------------------------
const DB_NAME = 'FaceRecognitionDB';
const DB_VERSION = 1;
const STORE_NAME = 'faces';

let db = null;

// Inicializar IndexedDB
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'username' });
            }
        };
    });
}

// Guardar datos de rostro en IndexedDB
function saveFaceData(username, landmarks) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Base de datos no inicializada'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const data = {
            username: username,
            landmarks: landmarks,
            timestamp: new Date().toISOString()
        };

        const request = store.put(data);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// Obtener datos de rostro de IndexedDB
function getFaceData(username) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Base de datos no inicializada'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(username);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
    });
}

// -------------------------------
// Registro/Login con IndexedDB
// -------------------------------
async function registerUser() {
    const username = document.querySelector("input[name='nombre']").value.trim();
    if (!username) return alert("Ingrese un nombre de usuario");
    if (!lastLandmarks) return alert("No se detectó un rostro");

    try {
        if (!db) await initIndexedDB();

        await saveFaceData(username, lastLandmarks);
        alert("Usuario " + username + " registrado con éxito ✅");
        console.log("Usuario registrado exitosamente");
    } catch (error) {
        console.error("Error al registrar usuario:", error);
        alert("Error al registrar usuario: " + error.message);
    }
}

async function loginUser() {
    const username = document.querySelector("input[name='nombre']").value.trim();
    if (!username) return alert("Ingrese un nombre de usuario");
    if (!lastLandmarks) return alert("No se detectó un rostro");

    try {
        if (!db) await initIndexedDB();

        const userData = await getFaceData(username);
        if (!userData) return alert("Usuario no encontrado");

        const storedLandmarks = userData.landmarks;

        // Comparación simple → distancia promedio entre los primeros 10 puntos
        let dist = 0;
        for (let i = 0; i < 10; i++) {
            const dx = storedLandmarks[i].x - lastLandmarks[i].x;
            const dy = storedLandmarks[i].y - lastLandmarks[i].y;
            dist += Math.sqrt(dx * dx + dy * dy);
        }
        dist /= 10;

        if (dist < 0.02) { // umbral de similitud (ajustable)
            console.log("Login correcto ✅ Bienvenido, " + username);
            alert("Login exitoso ✅ Bienvenido, " + username);
        } else {
            console.log("Login fallido ❌ El rostro no coincide");
            alert("Login fallido ❌ El rostro no coincide");
        }
    } catch (error) {
        console.error("Error al hacer login:", error);
        alert("Error al hacer login: " + error.message);
    }
}
