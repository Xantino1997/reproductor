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
  const screenStatus = document.getElementById("screenStatus");
  const screenStatusDot = document.getElementById("screenStatusDot");
  const secondScreenUrl = document.getElementById("secondScreenUrl");
  const copySecondScreenUrlBtn = document.getElementById("copySecondScreenUrl");

  let currentMediaURL = "";
  let currentMediaItem = null;
  let playlistItems = []; // [{ url, type, name }]
  let currentIndex = -1;
  let connectedScreens = 0;

  /* =====================================================================
     SOCKET.IO — sincroniza con cualquier pantalla conectada, esté en
     esta misma compu (otra pestaña) o en otro dispositivo de la red.
     ===================================================================== */
  const socket = io();

  socket.on("screen-count", (count) => {
    connectedScreens = count;
    updateScreenStatusUI();
  });

  socket.on("file-deleted", ({ name }) => {
    const item = playlistItems.find((i) => i.name === name);
    if (item) removePlaylistItem(item, { skipServerDelete: true });
  });

  function updateScreenStatusUI() {
    const connected = connectedScreens > 0;
    screenStatusDot.classList.toggle("online", connected);
    screenStatus.lastChild.textContent = connected
      ? ` ${connectedScreens} pantalla${connectedScreens > 1 ? "s" : ""} conectada${
          connectedScreens > 1 ? "s" : ""
        }`
      : " Ninguna pantalla conectada";
    activateSecondScreenBtn.classList.toggle("btn-active", connected);
    activateSecondScreenBtn.classList.toggle("btn-inactive", !connected);
    activateSecondScreenBtn.setAttribute("aria-pressed", String(connected));
  }

  function syncWithSecondScreen(type, fileURL = "", fileName = "", action = "play") {
    socket.emit("now-playing", { type, url: fileURL, name: fileName, action });
    const visorElement = document.getElementById("scrollingMessage");
    if (visorElement && fileName) {
      const span = visorElement.querySelector("span");
      if (span) span.textContent = fileName;
    }
  }

  /* =====================================================================
     PANEL "ABRIR EN OTRO DISPOSITIVO"
     ===================================================================== */
  const screenPageURL = `${window.location.origin}/pantalla.html`;
  secondScreenUrl.value = screenPageURL;
  updateScreenStatusUI();

  copySecondScreenUrlBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(screenPageURL);
      copySecondScreenUrlBtn.textContent = "¡Copiado!";
    } catch (err) {
      secondScreenUrl.select();
      document.execCommand("copy");
      copySecondScreenUrlBtn.textContent = "¡Copiado!";
    }
    setTimeout(() => {
      copySecondScreenUrlBtn.textContent = "Copiar";
    }, 1500);
  });

  // En la misma compu, este botón simplemente abre la pantalla en otra pestaña.
  activateSecondScreenBtn.addEventListener("click", () => {
    window.open(screenPageURL, "SecondScreen");
  });

  /* =====================================================================
     RECONOCIMIENTO DE VOZ
     - Safari iOS no implementa SpeechRecognition: antes esto crasheaba
       toda la app apenas cargaba la página en un iPhone.
     - En mobile, pedir el micrófono sin que el usuario toque algo suele
       ser bloqueado por el navegador, así que ahora arranca solo cuando
       se toca el botón "Comandos de voz".
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
      } else if (command.includes("siguiente")) {
        playNextItem();
      } else if (command.includes("volver") || command.includes("anterior")) {
        playPreviousItem();
      }
    };

    r.onerror = (event) => {
      console.warn("Error de reconocimiento de voz:", event.error);
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

  /* =====================================================================
     CONTROL DE MEDIOS
     ===================================================================== */
  function playVideo() {
    if (videoPlayer.src) {
      videoPlayer.play();
      syncWithSecondScreen("video", videoPlayer.src, currentMediaName(), "play");
    }
  }

  function playAudio() {
    if (audioPlayer.src) {
      audioPlayer.play();
      syncWithSecondScreen("audio", audioPlayer.src, currentMediaName(), "play");
    }
  }

  function pauseVideo() {
    if (videoPlayer.src) {
      videoPlayer.pause();
      syncWithSecondScreen("video", videoPlayer.src, currentMediaName(), "pause");
    }
  }

  function pauseAudio() {
    if (audioPlayer.src) {
      audioPlayer.pause();
      syncWithSecondScreen("audio", audioPlayer.src, currentMediaName(), "pause");
    }
  }

  function stopVideo() {
    if (videoPlayer.src) {
      videoPlayer.pause();
      videoPlayer.currentTime = 0;
      syncWithSecondScreen("video", videoPlayer.src, "", "stop");
    }
  }

  function stopAudio() {
    if (audioPlayer.src) {
      audioPlayer.pause();
      audioPlayer.currentTime = 0;
      syncWithSecondScreen("audio", audioPlayer.src, "", "stop");
    }
  }

  function currentMediaName() {
    return currentMediaItem ? currentMediaItem.dataset.name : "";
  }

  /* =====================================================================
     SUBIDA DE ARCHIVOS — ahora va al servidor (POST /upload) en vez de
     quedar como blob: en memoria. Así cualquier pantalla, en cualquier
     dispositivo, puede pedir la misma URL y la playlist sobrevive a un
     refresh de página.
     ===================================================================== */
  uploadBtn.addEventListener("click", () => fileInput.click());
  dragDropArea.addEventListener("click", () => fileInput.click());
  dragDropArea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", (e) => {
    handleFiles(e.target.files);
    fileInput.value = "";
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

  async function handleFiles(files) {
    for (const file of files) {
      const placeholderItem = addPlaylistItem({
        name: null,
        originalName: file.name,
        type: file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
          ? "audio"
          : "image",
        url: null,
        uploading: true,
      });

      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Error al subir el archivo");

        finalizePlaylistItem(placeholderItem, data.file);
      } catch (err) {
        console.error(err);
        placeholderItem.remove();
        if (window.Swal) {
          Swal.fire({
            icon: "error",
            title: "No se pudo subir el archivo",
            text: `${file.name}: ${err.message}`,
          });
        }
      }
    }
  }

  /* =====================================================================
     PLAYLIST — cada <li> guarda sus datos en dataset, y el array
     playlistItems se mantiene sincronizado con lo que devuelve el server.
     ===================================================================== */
  function addPlaylistItem({ name, originalName, type, url, uploading }) {
    const listItem = document.createElement("li");
    const fileNameSpan = document.createElement("span");
    const removeBtn = document.createElement("button");

    listItem.className = "playlist-item";
    listItem.dataset.name = name || "";
    listItem.dataset.type = type;
    listItem.dataset.url = url || "";

    fileNameSpan.textContent = uploading ? `Subiendo: ${originalName}…` : originalName;
    removeBtn.textContent = "Eliminar";
    removeBtn.className = "remove-btn";
    removeBtn.setAttribute("aria-label", `Eliminar ${originalName}`);
    removeBtn.disabled = !!uploading;

    listItem.appendChild(fileNameSpan);
    listItem.appendChild(removeBtn);
    playlist.appendChild(listItem);

    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = playlistItems.find((i) => i.name === listItem.dataset.name);
      const confirmAndRemove = () => removePlaylistItem(item || { name: listItem.dataset.name, listItem });

      if (window.Swal) {
        Swal.fire({
          title: "¿Estás seguro?",
          text: `¿Quieres eliminar ${originalName}?`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "¡Sí, elimínalo!",
          cancelButtonText: "No, cancelar",
        }).then((result) => {
          if (result.isConfirmed) confirmAndRemove();
        });
      } else if (confirm(`¿Quieres eliminar ${originalName}?`)) {
        confirmAndRemove();
      }
    });

    listItem.addEventListener("click", () => {
      if (uploading || !listItem.dataset.url) return;
      updateDisplay(listItem.dataset.url, listItem.dataset.type, originalName, listItem);
    });

    return listItem;
  }

  function finalizePlaylistItem(listItem, fileInfo) {
    listItem.dataset.name = fileInfo.name;
    listItem.dataset.url = fileInfo.url;
    listItem.dataset.type = fileInfo.type;
    listItem.querySelector("span").textContent = fileInfo.originalName;
    listItem.querySelector("button").disabled = false;

    const entry = { name: fileInfo.name, url: fileInfo.url, type: fileInfo.type, listItem };
    playlistItems.push(entry);

    if (currentMediaURL === "") {
      updateDisplay(fileInfo.url, fileInfo.type, fileInfo.originalName, listItem);
    }
  }

  function removePlaylistItem(item, { skipServerDelete = false } = {}) {
    const listItem = item.listItem || playlist.querySelector(`li[data-name="${item.name}"]`);

    const doRemove = () => {
      if (listItem) listItem.remove();
      playlistItems = playlistItems.filter((i) => i.name !== item.name);
      if (item.url === currentMediaURL) {
        currentMediaItem = null;
        currentMediaURL = "";
        videoPlayer.src = "";
        videoPlayer.hidden = true;
        imageDisplay.hidden = true;
        audioPlayer.src = "";
        audioPlayer.hidden = true;
        syncWithSecondScreen("stop", "", "", "stop");
      }
    };

    if (skipServerDelete || !item.name) {
      doRemove();
      return;
    }

    fetch("/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: item.name }),
    })
      .then(() => doRemove())
      .catch((err) => {
        console.error("No se pudo eliminar en el servidor:", err);
        doRemove();
      });
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
    syncWithSecondScreen(mediaType, fileURL, fileName, "play");
  }

  function playNextItem() {
    if (playlistItems.length === 0) return;
    currentIndex = (currentIndex + 1) % playlistItems.length;
    const item = playlistItems[currentIndex];
    updateDisplay(item.url, item.type, item.listItem.querySelector("span").textContent, item.listItem);
  }

  function playPreviousItem() {
    if (playlistItems.length === 0) return;
    currentIndex = (currentIndex - 1 + playlistItems.length) % playlistItems.length;
    const item = playlistItems[currentIndex];
    updateDisplay(item.url, item.type, item.listItem.querySelector("span").textContent, item.listItem);
  }

  /* =====================================================================
     CARGAR PLAYLIST EXISTENTE AL ABRIR LA PÁGINA
     ===================================================================== */
  async function loadExistingFiles() {
    try {
      const res = await fetch("/files");
      const files = await res.json();
      files.forEach((f) => {
        const listItem = addPlaylistItem({
          name: f.name,
          originalName: f.name,
          type: f.type,
          url: f.url,
          uploading: false,
        });
        listItem.dataset.url = f.url;
        listItem.dataset.type = f.type;
        playlistItems.push({ name: f.name, url: f.url, type: f.type, listItem });
      });
    } catch (err) {
      console.error("No se pudo cargar la playlist existente:", err);
    }
  }

  loadExistingFiles();
});
