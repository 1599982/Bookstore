const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

let camera = null;
let lastLandmarks = null; // último rostro detectado
let lastDetectionTime = null; // tiempo de la última detección

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

// Actualizar indicador visual de detección
function updateDetectionStatus() {
    const statusElement = document.getElementById("detection-status");
    if (statusElement) {
        if (isFaceCurrentlyDetected()) {
            statusElement.textContent = "✅ Rostro detectado";
            statusElement.style.color = "green";
        } else {
            statusElement.textContent = "❌ No se detecta rostro";
            statusElement.style.color = "red";
        }
    }
}

async function onResults(results){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if(results.multiFaceLandmarks && results.multiFaceLandmarks.length){
    const landmarks = results.multiFaceLandmarks[0];
    lastLandmarks = landmarks; // guardamos rostro actual
    lastDetectionTime = Date.now(); // guardamos tiempo de detección

    // Dibujar malla
    drawConnectors(ctx, landmarks, FACEMESH_TESSELATION, {lineWidth:1, color:'#00FF00'});
    drawConnectors(ctx, landmarks, FACEMESH_RIGHT_EYE, {lineWidth:2, color:'#FF0000'});
    drawConnectors(ctx, landmarks, FACEMESH_LEFT_EYE, {lineWidth:2, color:'#0000FF'});
    drawConnectors(ctx, landmarks, FACEMESH_LIPS, {lineWidth:2, color:'#FFFF00'});
    }

    // Actualizar indicador visual
    updateDetectionStatus();
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

    // Iniciar actualización periódica del estado de detección
    setInterval(updateDetectionStatus, 500); // Actualizar cada 500ms
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

// Función para verificar si hay detección facial reciente y válida
function isFaceCurrentlyDetected() {
    if (!lastLandmarks || !lastDetectionTime) return false;
    const now = Date.now();
    const timeSinceDetection = now - lastDetectionTime;

    // Verificar que la detección sea reciente (último segundo)
    if (timeSinceDetection > 1000) return false;

    // Verificar que los landmarks tengan datos válidos
    if (!Array.isArray(lastLandmarks) || lastLandmarks.length < 50) return false;

    // Verificar que las coordenadas no sean todas cero (indicaría error)
    const validPoints = lastLandmarks.slice(0, 10).filter(p =>
        p && typeof p.x === 'number' && typeof p.y === 'number' &&
        (p.x !== 0 || p.y !== 0)
    );

    return validPoints.length >= 8; // Al menos 8 de 10 puntos válidos
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
    // Validar que haya detección facial actual y válida
    if (!isFaceCurrentlyDetected()) {
        return alert("⚠️ No se detectó un rostro válido.\n\nPor favor:\n• Destape la cámara\n• Mire directamente a la cámara\n• Asegúrese de tener buena iluminación\n• Espere a ver el indicador verde '✅ Rostro detectado'");
    }

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
        const fechaRegistro = new Date();
        const completeUserData = {
            nombre: nombre,
            apellido: apellido,
            telefono: telefono,
            correo: correo,
            contrasena: contrasena, // En producción, esto debería estar hasheado
            landmarks: lastLandmarks,
            fechaRegistro: fechaRegistro.toISOString(),
            fechaRegistroFormateada: fechaRegistro.toLocaleString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }),
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
        }, 1000);

    } catch (error) {
        console.error("Error al registrar usuario:", error);
        alert("Error al registrar usuario: " + error.message);
    }
}

// Variables para escaneo facial automático
let isScanning = false;
let scanInterval = null;

// Función de escaneo facial automático
async function iniciarEscaneoFacial() {
    if (isScanning) return;

    try {
        if (!db) await initIndexedDB();

        isScanning = true;
        console.log("🔍 Iniciando escaneo facial automático...");

        // Cambiar interfaz para mostrar que está escaneando
        const statusElement = document.getElementById("detection-status");
        if (statusElement) {
            statusElement.textContent = "🔍 Escaneando rostro... Mire a la cámara";
            statusElement.style.color = "orange";
        }

        // Iniciar escaneo cada 1 segundo
        scanInterval = setInterval(async () => {
            if (isFaceCurrentlyDetected()) {
                await compararConBaseDatos();
            }
        }, 1000);

    } catch (error) {
        console.error("Error al iniciar escaneo:", error);
        alert("Error al iniciar escaneo facial: " + error.message);
        detenerEscaneo();
    }
}

// Función para comparar rostro actual con todos los usuarios en la base de datos
async function compararConBaseDatos() {
    try {
        // Obtener todos los usuarios de la base de datos
        const usuarios = await obtenerTodosLosUsuarios();

        if (usuarios.length === 0) {
            console.log("No hay usuarios registrados en la base de datos");
            return;
        }

        // Comparar con cada usuario
        for (const userData of usuarios) {
            if (!userData.landmarks) continue;

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
                // ¡Rostro encontrado!
                detenerEscaneo();
                const welcomeName = userData.nombre ? `${userData.nombre} ${userData.apellido || ''}`.trim() : userData.correo;
                console.log("✅ Rostro identificado: " + welcomeName);

                // Guardar datos del usuario en sessionStorage para bienvenido.html
                sessionStorage.setItem('currentUser', JSON.stringify({
                    correo: userData.correo,
                    nombre: userData.nombre,
                    apellido: userData.apellido,
                    telefono: userData.telefono,
                    fechaRegistro: userData.fechaRegistro,
                    fechaRegistroFormateada: userData.fechaRegistroFormateada,
                    loginTime: new Date().toISOString()
                }));
                
                // También guardar en localStorage para persistencia
                localStorage.setItem('loggedUser', JSON.stringify({
                    correo: userData.correo,
                    nombre: userData.nombre,
                    apellido: userData.apellido,
                    telefono: userData.telefono,
                    fechaRegistro: userData.fechaRegistro,
                    fechaRegistroFormateada: userData.fechaRegistroFormateada,
                    loginTime: new Date().toISOString()
                }));

                // Redirigir a bienvenido.html
                window.location.href = "bienvenido.html";
                return;
            }
        }

        // Si llegamos aquí, no se encontró coincidencia después de un tiempo
        console.log("👤 Rostro no encontrado en la base de datos");

        // Detener escaneo después de 30 segundos sin encontrar coincidencia
        setTimeout(() => {
            if (isScanning) {
                detenerEscaneo();
                const statusElement = document.getElementById("detection-status");
                if (statusElement) {
                    statusElement.textContent = "⏰ Escaneo finalizado - Rostro no reconocido";
                    statusElement.style.color = "red";
                }
                alert("Rostro no reconocido. Por favor regístrese o use login manual.");
            }
        }, 30000);

    } catch (error) {
        console.error("Error al comparar con base de datos:", error);
        detenerEscaneo();
    }
}

// Función para obtener todos los usuarios de IndexedDB
function obtenerTodosLosUsuarios() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('Base de datos no inicializada'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
    });
}

// Función para detener el escaneo
function detenerEscaneo() {
    isScanning = false;
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }

    const statusElement = document.getElementById("detection-status");
    if (statusElement) {
        updateDetectionStatus(); // Volver al estado normal
    }
}

async function loginUser() {
    const emailInput = document.querySelector("input[name='correo']") || document.querySelector("input[name='nombre']");
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email) return alert("Ingrese su correo electrónico");
    // Validar que haya detección facial actual y válida para login
    if (!isFaceCurrentlyDetected()) {
        return alert("⚠️ No se detectó un rostro válido.\n\nPor favor:\n• Destape la cámara\n• Mire directamente a la cámara\n• Asegúrese de tener buena iluminación\n• Espere a ver el indicador verde '✅ Rostro detectado'");
    }

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

        if (dist < 0.8) { // umbral de similitud (ajustable)
            const welcomeName = userData.nombre ? `${userData.nombre} ${userData.apellido || ''}`.trim() : email;
            console.log("Login correcto ✅ Bienvenido, " + welcomeName);
            alert(`Login exitoso ✅ Bienvenido, ${welcomeName}!`);

            // Guardar datos de sesión
            sessionStorage.setItem('currentUser', JSON.stringify({
                correo: userData.correo,
                nombre: userData.nombre,
                apellido: userData.apellido,
                telefono: userData.telefono,
                fechaRegistro: userData.fechaRegistro,
                fechaRegistroFormateada: userData.fechaRegistroFormateada,
                loginTime: new Date().toISOString()
            }));
            
            // También guardar en localStorage para persistencia
            localStorage.setItem('loggedUser', JSON.stringify({
                correo: userData.correo,
                nombre: userData.nombre,
                apellido: userData.apellido,
                telefono: userData.telefono,
                fechaRegistro: userData.fechaRegistro,
                fechaRegistroFormateada: userData.fechaRegistroFormateada,
                loginTime: new Date().toISOString()
            }));
            
            // También guardar en localStorage para persistencia
            localStorage.setItem('loggedUser', JSON.stringify({
                correo: userData.correo,
                nombre: userData.nombre,
                apellido: userData.apellido,
                telefono: userData.telefono,
                loginTime: new Date().toISOString()
            }));

            // Redirigir a bienvenido.html
            window.location.href = "bienvenido.html";

        } else {
            console.log("Login fallido ❌ El rostro no coincide");
            alert("Login fallido ❌ El rostro no coincide con el registrado");
        }
    } catch (error) {
        console.error("Error al hacer login:", error);
        alert("Error al hacer login: " + error.message);
    }
}
