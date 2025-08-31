// Elementos
const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const ctx = canvas.getContext("2d");

let camera = null;
let lastTime = performance.now();
let frameCount = 0;

// INICIALIZAR FaceMesh de MediaPipe
const faceMesh = new FaceMesh({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({
    maxNumFaces: 2,
    refineLandmarks: true, // obtiene puntos extra alrededor de ojos/labios
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.5
});

faceMesh.onResults(onResults);

// Opcional: cargar BlazeFace (TensorFlow.js) para pre-detección
let blazefaceModel = null;
async function loadBlazeFace(){
    try{
    blazefaceModel = await blazeface.load();
    console.log('BlazeFace cargado');
    }catch(e){
    console.warn('No se pudo cargar BlazeFace (opcional):', e);
    }
}
loadBlazeFace();

function resizeCanvasToVideo(){
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    // canvas.style.width = video.clientWidth + 'px';
    // canvas.style.height = video.clientHeight + 'px';
}

async function onResults(results){
    // Dibujar video en canvas (opcional - lo dejamos transparente para overlay limpio)
    ctx.clearRect(0,0,canvas.width,canvas.height);

    if(results.multiFaceLandmarks && results.multiFaceLandmarks.length){
    for(const landmarks of results.multiFaceLandmarks){
        // Dibujar puntos y conexiones usando drawing_utils de MediaPipe
        drawConnectors(ctx, landmarks, FaceMesh.FACEMESH_TESSELATION, {lineWidth:1});
        drawConnectors(ctx, landmarks, FaceMesh.FACEMESH_RIGHT_EYE, {lineWidth:2});
        drawConnectors(ctx, landmarks, FaceMesh.FACEMESH_LEFT_EYE, {lineWidth:2});
        drawConnectors(ctx, landmarks, FaceMesh.FACEMESH_LIPS, {lineWidth:2});
        for(let i=0;i<landmarks.length;i++){
        const x = landmarks[i].x * canvas.width;
        const y = landmarks[i].y * canvas.height;
        ctx.beginPath();
        ctx.arc(x,y,1.2,0,2*Math.PI);
        ctx.fillStyle = 'rgba(0,200,255,0.9)';
        ctx.fill();
        }
    }
    }
}

async function startCamera(){
    // Pide permisos y configura video
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width:1280, height:720 }, audio:false });
    video.srcObject = stream;

    await video.play();
    resizeCanvasToVideo();

    // Usar MediaPipe Camera util para enviar frames a FaceMesh
    camera = new Camera(video, {
    onFrame: async () => {
        // Si quieres usar BlazeFace como pre-check, puedes hacerlo aquí (opcional):
        // if(blazefaceModel){ const predictions = await blazefaceModel.estimateFaces(video, false); /* puedes usar predictions */ }

        await faceMesh.send({image: video});
    },
    width: video.videoWidth,
    height: video.videoHeight
    });
    camera.start();
}

function stopCamera(){
    if(camera) camera.stop();
    const tracks = video.srcObject ? video.srcObject.getTracks() : [];
    tracks.forEach(t => t.stop());
    video.srcObject = null;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    fpsLabel.textContent = '—';
}

document.addEventListener("DOMContentLoaded", () => {
	startCamera().catch(err=> {
		alert("Error accediendo a la cámara: " + err.message)
	})
})

// Reajustar canvas cuando cambie el tamaño
window.addEventListener('resize', () => { if(video.videoWidth) resizeCanvasToVideo(); });

// Nota: para ejecutar localmente sirve usar un servidor (p. ej. `npx http-server` o la extensión Live Server de VSCode) porque algunos navegadores exigen contexto seguro para getUserMedia.
