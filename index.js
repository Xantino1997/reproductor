const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// Crear las carpetas si no existen
const createUploadFolders = () => {
  const directories = ['uploads/videos', 'uploads/images'];
  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

createUploadFolders();

// Configurar multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = 'uploads/images';
    if (file.mimetype.startsWith('video/')) {
      uploadPath = 'uploads/videos';
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname); // Usar el nombre original del archivo
  }
});

const upload = multer({ storage: storage });

// Middleware para servir archivos estáticos
app.use(express.static('public'));

// Ruta para subir archivos
app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ message: 'Archivo subido exitosamente', file: req.file });
});

// Ruta para eliminar archivos
app.post('/delete', express.json(), (req, res) => {
  const { fileName, fileType } = req.body;
  const filePath = fileType === 'video' ? `uploads/videos/${fileName}` : `uploads/images/${fileName}`;

  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ message: 'Error al eliminar el archivo', error: err });
    }
    res.json({ message: 'Archivo eliminado exitosamente' });
  });
});

// Ruta para listar archivos
app.get('/files', (req, res) => {
  const files = {
    images: [],
    videos: []
  };

  const readDir = (dir, fileList) => {
    fs.readdir(dir, (err, items) => {
      if (err) {
        return res.status(500).json({ message: 'Error al leer el directorio', error: err });
      }
      items.forEach(item => {
        fileList.push(item);
      });
    });
  };

  readDir('uploads/images', files.images);
  readDir('uploads/videos', files.videos);

  setTimeout(() => {
    res.json(files);
  }, 100); // Ajustar el tiempo si es necesario para asegurar que la lectura del directorio se complete
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
