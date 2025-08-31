const video = document.getElementById('video');

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
    .catch((err) => console.error('Error accediendo a la cámara:', err));
}

// Captura facial cuando se envía el formulario
document.getElementById('registroForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const detections = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

  if (!detections) {
    alert("No se detectó ningún rostro. Asegúrate de estar frente a la cámara.");
    return;
  }

  const datosUsuario = {
    nombre: this.nombre.value,
    apellido: this.apellido.value,
    telefono: this.telefono.value,
    correo: this.correo.value,
    contrasena: this.contrasena.value,
    descriptor: Array.from(detections.descriptor), // Guardamos el descriptor como array
  };

  // Simulación de guardado en localStorage (puede usarse backend real)
  localStorage.setItem("usuarioRegistrado", JSON.stringify(datosUsuario));
  alert("Registro exitoso con datos faciales.");
  window.location.href = "login.html";
});

// Mostrar/Ocultar contraseña
function togglePassword() {
  const pwd = document.getElementById("password");
  pwd.type = pwd.type === "password" ? "text" : "password";
}
