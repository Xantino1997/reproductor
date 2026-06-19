document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const fileInput = document.getElementById("fileInput");
  const dragDropArea = document.getElementById("dragDropArea");
  const videoPlayer = document.getElementById("videoPlayer");
  const imageDisplay = document.getElementById("imageDisplay");
  const audioPlayer = document.getElementById("audioPlayer");
  const activateSecondScreenBtn = document.getElementById("activateSecondScreenBtn");
  const voiceCmdBtn = document.getElementById("voiceCmdBtn");
  const playlist = document.getElementById("playlist");

  let secondScreenWindow = null;
  let currentMediaURL = "";
  let currentMediaItem = null;
  let playlistItems = []; // Lista de elementos de la lista de reproducción
  let currentIndex = -1; // Índice del elemento actualmente en reproducción

  /* =====================================================================
     RECONOCIMIENTO DE VOZ
     - Safari iOS no implementa SpeechRecognition: antes esto crasheaba
       toda la app apenas cargaba la página en un iPhone.
     - En mobile, pedir el micrófono sin que el usuario toque algo suele
       ser bloqueado por el navegador, así que ahora el reconocimiento
       arranca solo cuando se toca el botón "Comandos de voz".
     ===================================================================== */
  const SpeechRecognitionAPI =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const voiceSupported = !!SpeechRecognitionAPI;
  let recognition = null;
  let voiceActive = false;
  let voiceStoppedByUser = false;

  if (!voiceSupported && voiceCmdBtn) {
    voiceCmdBtn.disabled = true;
    voiceCmdBtn.textContent = "Comandos de voz no disponibles";
    voiceCmdBtn.title =
      "Este navegador no soporta reconocimiento de voz (por ejemplo Safari en iPhone/iPad).";
  }

  function buildRecognition() {
    const r = new SpeechRecognitionAPI();
    r.lang = "es-ES";
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onresult = (event) => {
      const command = event.results[0][0].transcript.toLowerCase();
      console.log("Comando recibido:", command);

      if (command.includes("reproducir video") || command.includes("play video")) {
        playVideo();
      } else if (command.includes("reproducir audio") || command.includes("play audio")) {
        playAudio();
      } else if (command.includes("pausar video") || command.includes("pause video")) {
        pauseVideo();
      } else if (command.includes("pausar audio") || command.includes("pause audio")) {
        pauseAudio();
      } else if (command.includes("detener video") || command.includes("stop video")) {
        stopVideo();
      } else if (command.includes("detener audio") || command.includes("stop audio")) {
        stopAudio();
      } else if (
        command.includes("segunda pantalla") ||
        command.includes("abrir pantalla")
      ) {
        toggleSecondScreen();
      } else if (command.includes("maximizar")) {
        maximizeSecondScreen();
      } else if (command.includes("minimizar")) {
        minimizeSecondScreen();
      } else if (command.includes("siguiente")) {
        playNextItem();
      } else if (command.includes("volver") || command.includes("anterior")) {
        playPreviousItem();
      }
    };

    r.onerror = (event) => {
      console.warn("Error de reconocimiento de voz:", event.error);
      // Si el usuario negó el permiso del micrófono, no insistimos en loop.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        voiceStoppedByUser = true;
        setVoiceUI(false);
        if (window.Swal) {
          Swal.fire({
            icon: "warning",
            title: "Micrófono bloqueado",
            text: "Activá el permiso de micrófono en el navegador para usar comandos de voz.",
          });
        }
      }
    };

    r.onend = () => {
      // Reinicia solo si el usuario no lo apagó manualmente ni hubo error de permisos.
      if (voiceActive && !voiceStoppedByUser) {
        try {
          r.start();
        } catch (err) {
          console.warn("No se pudo reiniciar el reconocimiento de voz:", err);
        }
      }
    };

    return r;
  }

  function setVoiceUI(active) {
    voiceActive = active;
    if (!voiceCmdBtn) return;
    voiceCmdBtn.textContent = active
      ? "🎤 Comandos de voz: activados"
      : "🎤 Activar comandos de voz";
    voiceCmdBtn.classList.toggle("btn-active", active);
    voiceCmdBtn.classList.toggle("btn-inactive", !active);
  }

  if (voiceSupported && voiceCmdBtn) {
    setVoiceUI(false);
    voiceCmdBtn.addEventListener("click", () => {
      if (!voiceActive) {
        voiceStoppedByUser = false;
        recognition = recognition || buildRecognition();
        try {
          recognition.start();
          setVoiceUI(true);
        } catch (err) {
          console.warn("No se pudo iniciar el reconocimiento de voz:", err);
        }
      } else {
        voiceStoppedByUser = true;
        if (recognition) recognition.stop();
        setVoiceUI(false);
      }
    });
  }

  // Funciones de control de medios
  function playVideo() {
    if (videoPlayer.src) {
      videoPlayer.play();
      syncWithSecondScreen("play", "video");
    }
  }

  function playAudio() {
    if (audioPlayer.src) {
      audioPlayer.play();
      syncWithSecondScreen("play", "audio");
    }
  }

  function pauseVideo() {
    if (videoPlayer.src) {
      videoPlayer.pause();
      syncWithSecondScreen("pause", "video");
    }
  }

  function pauseAudio() {
    if (audioPlayer.src) {
      audioPlayer.pause();
      syncWithSecondScreen("pause", "audio");
    }
  }

  function stopVideo() {
    if (videoPlayer.src) {
      videoPlayer.pause();
      videoPlayer.currentTime = 0;
      syncWithSecondScreen("stop", "video");
    }
  }

  function stopAudio() {
    if (audioPlayer.src) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      syncWithSecondScreen("stop");
    }
  }

  /* =====================================================================
     SEGUNDA PANTALLA
     - Sigue siendo window.open(): pensado para cuando el dispositivo está
       conectado a un segundo monitor/TV (lo normal en un club o salón).
     - En un celular no hay un "segundo monitor" real, así que avisamos
       si el navegador bloqueó el popup en vez de fallar en silencio.
     ===================================================================== */
  function toggleSecondScreen() {
    if (!secondScreenWindow || secondScreenWindow.closed) {
      openSecondScreen();
    } else {
      secondScreenWindow.close();
      secondScreenWindow = null;
      activateSecondScreenBtn.classList.remove("btn-active");
      activateSecondScreenBtn.classList.add("btn-inactive");
      activateSecondScreenBtn.textContent = "Activar segunda pantalla";
      activateSecondScreenBtn.setAttribute("aria-pressed", "false");
    }
  }

  activateSecondScreenBtn.addEventListener("click", () => {
    toggleSecondScreen();
  });

  function openSecondScreen() {
    secondScreenWindow = window.open(
      "",
      "SecondScreen",
      "width=800,height=600"
    );

    if (!secondScreenWindow) {
      // Popup bloqueado: muy común en navegadores mobile.
      if (window.Swal) {
        Swal.fire({
          icon: "info",
          title: "No se pudo abrir la segunda pantalla",
          text:
            "El navegador bloqueó la ventana emergente. Permití pop-ups para este sitio, o conectá el dispositivo a una pantalla externa.",
        });
      }
      return;
    }

    secondScreenWindow.document.write(`
      <html>
      <head>
        <link rel="icon" href="./Img/Empathia.png" type="image/png" />
        <title>Segunda Pantalla</title>
        <style>
          body { margin: 0; padding: 0; overflow: hidden; background: #000; }
          #secondScreenVideo, #secondScreenImage {
            width: 100%;
            height: 100vh;
            object-fit: contain;
          }
        </style>
      </head>
      <body>
        <video id="secondScreenVideo" controls playsinline style="display: none;"></video>
        <img id="secondScreenImage" style="display: none;" />
        <script>
          const video = document.getElementById('secondScreenVideo');
          const image = document.getElementById('secondScreenImage');

          window.addEventListener('message', (event) => {
            const data = event.data;
            if (data.type === 'video') {
              video.src = data.src;
              video.style.display = 'block';
              image.style.display = 'none';
              if (data.action === 'play') video.play();
            } else if (data.type === 'image') {
              image.src = data.src;
              image.style.display = 'block';
              video.style.display = 'none';
            }
            if (data.action === 'play') {
              video.play();
            } else if (data.action === 'pause') {
              video.pause();
            } else if (data.action === 'stop') {
              video.pause();
              video.currentTime = 0;
            }
          });
        </script>
      </body>
      </html>
    `);

    activateSecondScreenBtn.classList.add("btn-active");
    activateSecondScreenBtn.classList.remove("btn-inactive");
    activateSecondScreenBtn.textContent = "En línea";
    activateSecondScreenBtn.setAttribute("aria-pressed", "true");

    syncWithSecondScreen(
      currentMediaURL ? "video" : "image",
      currentMediaURL,
      ""
    );
  }

  function maximizeSecondScreen() {
    if (secondScreenWindow && !secondScreenWindow.closed) {
      try {
        secondScreenWindow.moveTo(0, 0);
        secondScreenWindow.resizeTo(screen.width, screen.height);
      } catch (err) {
        // moveTo/resizeTo no funcionan en todos los navegadores mobile; se ignora.
      }
    }
  }

  function minimizeSecondScreen() {
    if (secondScreenWindow && !secondScreenWindow.closed) {
      try {
        secondScreenWindow.moveTo(screen.width - 200, screen.height - 200);
        secondScreenWindow.resizeTo(400, 400);
      } catch (err) {
        // idem arriba
      }
    }
  }

  function syncWithSecondScreen(action, fileURL = "", fileName = "") {
    if (secondScreenWindow && !secondScreenWindow.closed) {
      if (action === "video" || action === "image") {
        secondScreenWindow.postMessage(
          { type: action, src: fileURL, name: fileName, action: "play" },
          "*"
        );
      } else {
        secondScreenWindow.postMessage({ action }, "*");
      }
    }
    const visorElement = document.getElementById("scrollingMessage");
    if (visorElement && fileName) {
      const span = visorElement.querySelector("span");
      if (span) span.textContent = fileName;
    }
  }

  /* =====================================================================
     SUBIDA DE ARCHIVOS
     - El drag&drop HTML5 (dragover/drop) no dispara con touch en mobile.
     - Antes el área "dragDropArea" no tenía forma de abrirse al tocarla;
       ahora también abre el selector de archivos con un tap o con
       Enter/Espacio desde el teclado.
     ===================================================================== */
  uploadBtn.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    fileInput.value = ""; // permite volver a elegir el mismo archivo después
  });

  dragDropArea.addEventListener("click", () => {
    fileInput.click();
  });

  dragDropArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  dragDropArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDropArea.classList.add("drag-over");
  });

  dragDropArea.addEventListener("dragleave", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDropArea.classList.remove("drag-over");
  });

  dragDropArea.addEventListener("drop", (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDropArea.classList.remove("drag-over");
    handleFiles(e.dataTransfer.files);
  });

  function handleFiles(files) {
    for (const file of files) {
      const fileURL = URL.createObjectURL(file);
      const listItem = document.createElement("li");
      const fileName = document.createElement("span");
      const removeBtn = document.createElement("button");

      listItem.className = "playlist-item";
      fileName.textContent = file.name;
      removeBtn.textContent = "Eliminar";
      removeBtn.className = "remove-btn";
      removeBtn.setAttribute("aria-label", `Eliminar ${file.name}`);

      listItem.appendChild(fileName);
      listItem.appendChild(removeBtn);

      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const confirmAndRemove = () => {
          listItem.remove();
          URL.revokeObjectURL(fileURL);
          if (fileURL === currentMediaURL) {
            currentMediaItem = null;
            currentMediaURL = "";
            videoPlayer.src = "";
            videoPlayer.hidden = true;
            imageDisplay.hidden = true;
            audioPlayer.src = "";
            audioPlayer.hidden = true;
            syncWithSecondScreen("stop");
          }
          playlistItems = playlistItems.filter(
            (item) => item.url !== fileURL
          );
        };

        if (window.Swal) {
          Swal.fire({
            title: "¿Estás seguro?",
            text: `¿Quieres eliminar ${file.name}?`,
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "¡Sí, elimínalo!",
            cancelButtonText: "No, cancelar",
          }).then((result) => {
            if (result.isConfirmed) confirmAndRemove();
          });
        } else if (confirm(`¿Quieres eliminar ${file.name}?`)) {
          confirmAndRemove();
        }
      });

      listItem.addEventListener("click", () => {
        if (file.type.startsWith("video/")) {
          updateDisplay(fileURL, "video", file.name, listItem);
        } else if (file.type.startsWith("image/")) {
          updateDisplay(fileURL, "image", file.name, listItem);
        } else if (file.type.startsWith("audio/")) {
          updateDisplay(fileURL, "audio", file.name, listItem);
        }
      });

      playlist.appendChild(listItem);
      playlistItems.push({ url: fileURL, type: file.type, name: file.name });

      // Si es el primer archivo agregado, lo mostramos automáticamente
      if (currentMediaURL === "") {
        updateDisplay(
          fileURL,
          file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("audio/")
            ? "audio"
            : "image",
          file.name,
          listItem
        );
      }
    }
  }

  function updateDisplay(fileURL, mediaType, fileName, listItem) {
    if (mediaType === "video") {
      videoPlayer.src = fileURL;
      videoPlayer.hidden = false;
      videoPlayer.play();
      imageDisplay.hidden = true;
      audioPlayer.hidden = true;
    } else if (mediaType === "image") {
      imageDisplay.src = fileURL;
      imageDisplay.hidden = false;
      videoPlayer.hidden = true;
      audioPlayer.hidden = true;
    } else if (mediaType === "audio") {
      audioPlayer.src = fileURL;
      audioPlayer.hidden = false;
      videoPlayer.hidden = true;
      imageDisplay.hidden = true;
    }
    currentMediaURL = fileURL;
    currentMediaItem = listItem;
    syncWithSecondScreen(mediaType, fileURL, fileName);
  }

  function playNextItem() {
    if (playlistItems.length === 0) return;

    currentIndex = (currentIndex + 1) % playlistItems.length;
    const nextItem = playlistItems[currentIndex];
    updateDisplay(
      nextItem.url,
      nextItem.type.startsWith("video/")
        ? "video"
        : nextItem.type.startsWith("audio/")
        ? "audio"
        : "image",
      nextItem.name,
      null
    );
  }

  function playPreviousItem() {
    if (playlistItems.length === 0) return;

    currentIndex =
      (currentIndex - 1 + playlistItems.length) % playlistItems.length;
    const prevItem = playlistItems[currentIndex];
    updateDisplay(
      prevItem.url,
      prevItem.type.startsWith("video/")
        ? "video"
        : prevItem.type.startsWith("audio/")
        ? "audio"
        : "image",
      prevItem.name,
      null
    );
  }
});
