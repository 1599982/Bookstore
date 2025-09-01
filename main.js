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
function saveFaceData(username, data) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Base de datos no inicializada'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Si data es un array (landmarks), crear estructura simple
        // Si data es un objeto, usar los datos completos del usuario
        const userData = Array.isArray(data) ? {
            username: username,
            landmarks: data,
            timestamp: new Date().toISOString()
        } : {
            username: username,
            ...data,
            timestamp: data.timestamp || new Date().toISOString()
        };

        const request = store.put(userData);

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
    // Obtener datos del formulario
    const nombre = document.querySelector("input[name='nombre']").value.trim();
    const apellido = document.querySelector("input[name='apellido']").value.trim();
    const telefono = document.querySelector("input[name='telefono']").value.trim();
    const correo = document.querySelector("input[name='correo']").value.trim();
    const contrasena = document.querySelector("input[name='contrasena']").value.trim();

    // Validar datos del formulario
    if (!nombre) return alert("Ingrese su nombre");
    if (!apellido) return alert("Ingrese su apellido");
    if (!telefono) return alert("Ingrese su teléfono");
    if (!correo) return alert("Ingrese su correo");
    if (!contrasena) return alert("Ingrese su contraseña");
    if (!lastLandmarks) return alert("No se detectó un rostro");

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(correo)) {
        return alert("Por favor, ingrese un correo electrónico válido");
    }

    // Validar teléfono (solo números)
    const phoneRegex = /^\d{9,}$/;
    if (!phoneRegex.test(telefono)) {
        return alert("El teléfono debe contener al menos 9 dígitos");
    }

    try {
        if (!db) await initIndexedDB();

        // Verificar si el usuario ya existe
        const existingUser = await getFaceData(correo);
        if (existingUser) {
            return alert("Ya existe un usuario registrado con este correo electrónico");
        }

        // Preparar datos completos del usuario incluyendo landmarks
        const completeUserData = {
            nombre: nombre,
            apellido: apellido,
            telefono: telefono,
            correo: correo,
            contrasena: contrasena, // En producción, esto debería estar hasheado
            landmarks: lastLandmarks,
            timestamp: new Date().toISOString()
        };

        // Guardar en IndexedDB usando correo como identificador único
        await saveFaceData(correo, completeUserData);
        
        alert(`¡Usuario ${nombre} ${apellido} registrado exitosamente! ✅\nAhora puede iniciar sesión con reconocimiento facial.`);
        console.log("Usuario registrado exitosamente:", correo);
        
        // Limpiar formulario
        const form = document.getElementById("registroForm");
        if (form) form.reset();
        
        // Opcional: redirigir al login después de 2 segundos
        setTimeout(() => {
            window.location.href = "index.html";
        }, 2000);
        
    } catch (error) {
        console.error("Error al registrar usuario:", error);
        alert("Error al registrar usuario: " + error.message);
    }
}

async function loginUser() {
    const emailInput = document.querySelector("input[name='correo']") || document.querySelector("input[name='nombre']");
    const email = emailInput ? emailInput.value.trim() : '';
    
    if (!email) return alert("Ingrese su correo electrónico");
    if (!lastLandmarks) return alert("No se detectó un rostro. Por favor, mire directamente a la cámara");

    try {
        if (!db) await initIndexedDB();

        const userData = await getFaceData(email);
        if (!userData) return alert("Usuario no encontrado. ¿Se registró con este correo?");

        const storedLandmarks = userData.landmarks;
        if (!storedLandmarks) return alert("No hay datos faciales para este usuario");

        // Comparación simple → distancia promedio entre los primeros 10 puntos
        let dist = 0;
        for (let i = 0; i < 10; i++) {
            const dx = storedLandmarks[i].x - lastLandmarks[i].x;
            const dy = storedLandmarks[i].y - lastLandmarks[i].y;
            dist += Math.sqrt(dx * dx + dy * dy);
        }
        dist /= 10;

        if (dist < 0.02) { // umbral de similitud (ajustable)
            const welcomeName = userData.nombre ? `${userData.nombre} ${userData.apellido || ''}`.trim() : email;
            console.log("Login correcto ✅ Bienvenido, " + welcomeName);
            alert(`Login exitoso ✅ Bienvenido, ${welcomeName}!`);
            
            // Guardar datos de sesión
            sessionStorage.setItem('currentUser', JSON.stringify({
                correo: userData.correo,
                nombre: userData.nombre,
                apellido: userData.apellido,
                telefono: userData.telefono,
                loginTime: new Date().toISOString()
            }));
            
            // Opcional: redirigir a página principal
            // window.location.href = "dashboard.html";
            
        } else {
            console.log("Login fallido ❌ El rostro no coincide");
            alert("Login fallido ❌ El rostro no coincide con el registrado");
        }
    } catch (error) {
        console.error("Error al hacer login:", error);
        alert("Error al hacer login: " + error.message);
    }
}
