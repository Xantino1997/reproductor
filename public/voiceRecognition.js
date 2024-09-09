document.addEventListener("DOMContentLoaded", () => {
    const uploadBtn = document.getElementById("uploadBtn");
    const fileInput = document.getElementById("fileInput");
    const dragDropArea = document.getElementById("dragDropArea");
    const videoPlayer = document.getElementById("videoPlayer");
    const imageDisplay = document.getElementById("imageDisplay");
    const audioPlayer = document.getElementById("audioPlayer");
    const activateSecondScreenBtn = document.getElementById("activateSecondScreenBtn");
    const playlist = document.getElementById("playlist");
  
    let secondScreenWindow = null;
    let currentMediaURL = "";
    let currentMediaItem = null;
    let playlistItems = []; // Lista de elementos de la lista de reproducción
    let currentIndex = -1; // Índice del elemento actualmente en reproducción
  
    // Inicializar reconocimiento de voz en español
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
  
    recognition.onresult = (event) => {
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
    
    recognition.onend = () => {
      recognition.start();
    };
  
    recognition.start();
  
    // Funciones de control de medios
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
  
  
    // Función para abrir o maximizar la segunda pantalla
    function toggleSecondScreen() {
      if (!secondScreenWindow || secondScreenWindow.closed) {
        openSecondScreen();
        activateSecondScreenBtn.classList.add("btn-active");
        activateSecondScreenBtn.classList.remove("btn-inactive");
        activateSecondScreenBtn.textContent = "En línea";
      } else {
        secondScreenWindow.close();
        secondScreenWindow = null;
        activateSecondScreenBtn.classList.remove("btn-active");
        activateSecondScreenBtn.classList.add("btn-inactive");
        activateSecondScreenBtn.textContent = "Activar pantalla 2";
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
      secondScreenWindow.document.write(
        `
        <html>
        <head>
          <link rel="icon" href="./Img/Empathia.png" type="image/png" />
          <title>Segunda Pantalla</title>
          <style>
            body { margin: 0; padding: 0; overflow: hidden; }
            #secondScreenVideo, #secondScreenImage { 
              width: 100%; 
              height: 100vh; 
              object-fit: contain;
            }
          </style>
        </head>
        <body>
          <video id="secondScreenVideo" controls style="display: none;"></video>
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
        </html>`
      );
      syncWithSecondScreen(
        currentMediaURL ? "video" : "image",
        currentMediaURL,
        ""
      );
    }
  
    function maximizeSecondScreen() {
      if (secondScreenWindow && !secondScreenWindow.closed) {
        secondScreenWindow.moveTo(0, 0);
        secondScreenWindow.resizeTo(screen.width, screen.height);
      }
    }
  
    function minimizeSecondScreen() {
      if (secondScreenWindow && !secondScreenWindow.closed) {
        secondScreenWindow.moveTo(screen.width - 200, screen.height - 200);
        secondScreenWindow.resizeTo(400, 400);
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
      if (visorElement) {
        visorElement.textContent = fileName;
      }
    }
  
    // Manejar la subida de archivos
    uploadBtn.addEventListener("click", () => {
      fileInput.click();
    });
  
    fileInput.addEventListener("change", (e) => {
      handleFiles(e.target.files);
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
        removeBtn.textContent = "Remove";
        removeBtn.className = "remove-btn";
  
        listItem.appendChild(fileName);
        listItem.appendChild(removeBtn);
  
        removeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          Swal.fire({
            title: "¿Estás seguro?",
            text: "¿Quieres eliminar ${file.name}?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "¡Sí, elimínalo!",
            cancelButtonText: "No, cancelar",
          }).then((result) => {
            if (result.isConfirmed) {
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
            }
          });
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
          updateDisplay(fileURL, file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : "image", file.name, listItem);
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
      updateDisplay(nextItem.url, nextItem.type.startsWith("video/") ? "video" : nextItem.type.startsWith("audio/") ? "audio" : "image", nextItem.name, null);
    }
  
    function playPreviousItem() {
      if (playlistItems.length === 0) return;
  
      currentIndex = (currentIndex - 1 + playlistItems.length) % playlistItems.length;
      const prevItem = playlistItems[currentIndex];
      updateDisplay(prevItem.url, prevItem.type.startsWith("video/") ? "video" : prevItem.type.startsWith("audio/") ? "audio" : "image", prevItem.name, null);
    }
  });