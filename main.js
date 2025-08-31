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

document.addEventListener("DOMContentLoaded", () => {
	startCamera().catch(err => {
		alert("Error accediendo a la cámara: " + err.message);
	})
})

window.addEventListener('resize', () => { if(video.videoWidth) resizeCanvasToVideo(); });

// -------------------------------
// Registro/Login en localStorage
// -------------------------------
function registerUser(){
	const username = document.querySelector("input[name='nombre']").value.trim();
    if(!username) return alert("Ingrese un nombre de usuario");
    if(!lastLandmarks) return alert("No se detectó un rostro");

    // Guardar landmarks en localStorage
    localStorage.setItem("face_" + username, JSON.stringify(lastLandmarks));
    // statusBox.textContent = "Usuario " + username + " registrado con éxito ✅";
}

function loginUser(){
	const username = document.querySelector("input[name='nombre']").value.trim();
    if(!username) return alert("Ingrese un nombre de usuario");
    if(!lastLandmarks) return alert("No se detectó un rostro");

    const stored = localStorage.getItem("face_" + username);
    if(!stored) return alert("Usuario no encontrado");

    const storedLandmarks = JSON.parse(stored);

    // Comparación simple → distancia promedio entre los primeros 10 puntos
    let dist = 0;
    for(let i=0; i<10; i++){
    const dx = storedLandmarks[i].x - lastLandmarks[i].x;
    const dy = storedLandmarks[i].y - lastLandmarks[i].y;
    dist += Math.sqrt(dx*dx + dy*dy);
    }
    dist /= 10;

    if(dist < 0.02){ // umbral de similitud (ajustable)
   		console.log("Login correcto ✅ Bienvenido, " + username);
    } else {
   		console.log("Login fallido ❌ El rostro no coincide");
    }
}
