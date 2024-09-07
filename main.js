document.addEventListener('DOMContentLoaded', () => {
  const inputFile = document.getElementById('subir-imagen-boton');
  const lista = document.getElementById('lista');
  const limpiarListaBtn = document.getElementById('limpiarLista');
  const visorGeneral = document.getElementById('visorGeneral');
  const visorPequeño = document.getElementById('visorPequeño');

  inputFile.addEventListener('change', handleFileUpload);
  limpiarListaBtn.addEventListener('click', limpiarLista);

  function handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
          const listItem = document.createElement('li');
          const media = document.createElement(file.type.startsWith('image/') ? 'img' : 'video');
          media.src = e.target.result;
          media.className = 'media-item';
          media.style.maxWidth = '100px';
          media.style.maxHeight = '100px';
          media.style.cursor = 'pointer';
          media.addEventListener('click', () => {
              visorGeneral.src = e.target.result;
              visorPequeño.src = e.target.result;
          });

          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'Eliminar';
          deleteBtn.className = 'btn btn-danger btn-sm';
          deleteBtn.addEventListener('click', () => {
              listItem.remove();
              deleteFileFromBackend(e.target.result); // Remove from backend
          });

          listItem.appendChild(media);
          listItem.appendChild(deleteBtn);
          lista.appendChild(listItem);

          // Save the file to the backend
          uploadFileToBackend(file, e.target.result);
      };
      reader.readAsDataURL(file);
  }

  function limpiarLista() {
      lista.innerHTML = '';
      // Optionally clear the backend as well
      clearBackend();
  }

  function uploadFileToBackend(file, fileData) {
      const formData = new FormData();
      formData.append('file', file, file.name);
      fetch('/upload', { // Adjust the endpoint as needed
          method: 'POST',
          body: formData
      })
      .then(response => response.json())
      .then(data => console.log('File uploaded successfully:', data))
      .catch(error => console.error('Error uploading file:', error));
  }

  function deleteFileFromBackend(fileUrl) {
      fetch('/delete', { // Adjust the endpoint as needed
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: fileUrl })
      })
      .then(response => response.json())
      .then(data => console.log('File deleted successfully:', data))
      .catch(error => console.error('Error deleting file:', error));
  }

  function clearBackend() {
      fetch('/clear', { // Adjust the endpoint as needed
          method: 'POST'
      })
      .then(response => response.json())
      .then(data => console.log('Backend cleared:', data))
      .catch(error => console.error('Error clearing backend:', error));
  }
});
