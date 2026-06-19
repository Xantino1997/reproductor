const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/* =====================================================================
   Tipos de archivo permitidos
   ===================================================================== */
function mediaTypeFromMime(mimetype) {
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  if (mimetype.startsWith("image/")) return "image";
  return null;
}

/* =====================================================================
   Multer: guarda en /uploads con nombre único (evita pisar archivos
   con el mismo nombre) y sanitiza el nombre original.
   ===================================================================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB por archivo
  fileFilter: (req, file, cb) => {
    if (!mediaTypeFromMime(file.mimetype)) {
      return cb(new Error("Tipo de archivo no permitido"));
    }
    cb(null, true);
  },
});

/* =====================================================================
   Middlewares
   ===================================================================== */
app.use(express.json());
app.use(express.static("public"));
// Clave: esto es lo que faltaba en las versiones anteriores. Sin esta
// línea, las imágenes/videos subidos quedan en disco pero ninguna URL
// del tipo /uploads/archivo.jpg los expone -> por eso se veía negro.
app.use("/uploads", express.static(UPLOAD_DIR));

/* =====================================================================
   Subir archivo
   ===================================================================== */
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No se subió ningún archivo." });
  }
  const type = mediaTypeFromMime(req.file.mimetype);
  const item = {
    name: req.file.filename,
    originalName: req.file.originalname,
    type,
    url: `/uploads/${encodeURIComponent(req.file.filename)}`,
  };
  res.json({ message: "Archivo subido exitosamente", file: item });
});

// Si multer rechaza el archivo (tipo no permitido / muy pesado)
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
});

/* =====================================================================
   Listar archivos ya subidos (así la playlist persiste al recargar)
   ===================================================================== */
app.get("/files", (req, res) => {
  fs.readdir(UPLOAD_DIR, (err, items) => {
    if (err) {
      return res.status(500).json({ message: "Error al leer el directorio", error: err.message });
    }
    const files = items
      .filter((name) => name !== ".gitkeep")
      .map((name) => {
        const ext = path.extname(name).toLowerCase();
        const videoExts = [".mp4", ".webm", ".mov", ".m4v", ".ogv"];
        const audioExts = [".mp3", ".wav", ".ogg", ".m4a", ".aac"];
        const type = videoExts.includes(ext)
          ? "video"
          : audioExts.includes(ext)
          ? "audio"
          : "image";
        return { name, type, url: `/uploads/${encodeURIComponent(name)}` };
      });
    res.json(files);
  });
});

/* =====================================================================
   Eliminar archivo (sanitizado: solo el nombre de archivo, nunca rutas)
   ===================================================================== */
app.post("/delete", (req, res) => {
  const { fileName } = req.body;
  if (!fileName) {
    return res.status(400).json({ message: "Falta el nombre del archivo" });
  }
  const safeName = path.basename(fileName);
  const filePath = path.join(UPLOAD_DIR, safeName);

  fs.unlink(filePath, (err) => {
    if (err) {
      return res.status(500).json({ message: "Error al eliminar el archivo", error: err.message });
    }
    io.emit("file-deleted", { name: safeName });
    res.json({ message: "Archivo eliminado exitosamente" });
  });
});

/* =====================================================================
   Socket.IO: sincroniza qué se está reproduciendo entre el control
   (control.html / index.html) y cualquier pantalla conectada
   (pantalla.html), estén en el mismo dispositivo o en otro distinto.
   ===================================================================== */
let screenCount = 0;
let lastNowPlaying = null; // para que una pantalla que se conecta tarde vea lo último

io.on("connection", (socket) => {
  socket.on("screen-hello", () => {
    socket.data.isScreen = true;
    screenCount += 1;
    io.emit("screen-count", screenCount);
    if (lastNowPlaying) {
      socket.emit("now-playing", lastNowPlaying);
    }
  });

  socket.on("now-playing", (payload) => {
    lastNowPlaying = payload;
    socket.broadcast.emit("now-playing", payload);
  });

  socket.on("disconnect", () => {
    if (socket.data.isScreen) {
      screenCount = Math.max(0, screenCount - 1);
      io.emit("screen-count", screenCount);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Control:        http://localhost:${PORT}/index.html`);
  console.log(`Segunda pantalla: http://localhost:${PORT}/pantalla.html`);
});
