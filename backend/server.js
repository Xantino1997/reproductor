const express = require('express');
const fileUpload = require('express-fileupload');
const path = require('path');
const app = express();

app.use(express.static('public'));
app.use(fileUpload());

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/index.html'));
});

// Handle file uploads
app.post('/upload', (req, res) => {
  if (!req.files) {
    return res.status(400).send('No files were uploaded.');
  }

  let mediaFile = req.files.mediaFile;
  let uploadPath = __dirname + '/uploads/' + mediaFile.name;

  mediaFile.mv(uploadPath, (err) => {
    if (err) return res.status(500).send(err);
    res.send('File uploaded!');
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
