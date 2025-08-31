const video = document.getElementById('video');
const manualLoginForm = document.getElementById('manualLoginForm');

// Cargar modelos
Promise.all([
  faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
  faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
  faceapi.nets.faceRecognitionNet.loadFromUri('/models')
]).then(startVideo);

function startVideo() {
  navigator.mediaDevices.getUserMedia({ video: {} })
    .then((stream) => {
      video.srcObject = stream;
    })
    .catch((err) => console.error("Error al acceder a la cámara:", err));
}

// Comparar rostro actual con el registrado
async function iniciarEscaneoFacial() {
  const usuarioGuardado = JSON.parse(localStorage.getItem("usuarioRegistrado"));

  if (!usuarioGuardado || !usuarioGuardado.descriptor) {
    alert("No hay datos faciales registrados. Regístrate primero.");
    return;
  }

  const inputDescriptor = new Float32Array(usuarioGuardado.descriptor);

  const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

  if (!detection) {
    alert("No se detectó ningún rostro.");
    return;
  }

  const distance = faceapi.euclideanDistance(detection.descriptor, inputDescriptor);

  console.log("Distancia de similitud:", distance);

  if (distance < 0.5) {
    alert("Inicio de sesión exitoso");
    window.location.href = "bienvenida.html";
  } else {
    alert("Rostro no reconocido. Intente con correo y contraseña.");
  }
}

// Mostrar formulario de login manual
function mostrarFormulario() {
  manualLoginForm.style.display = "block";
}

// Login manual como respaldo
manualLoginForm.addEventListener("submit", function (e) {
  e.preventDefault();

  const correo = this.correo.value;
  const contrasena = this.contrasena.value;

  const usuario = JSON.parse(localStorage.getItem("usuarioRegistrado"));

  if (usuario && usuario.correo === correo && usuario.contrasena === contrasena) {
    alert("Inicio de sesión exitoso.");
    window.location.href = "bienvenida.html";
  } else {
    alert("Credenciales incorrectas.");
  }
  
});
