const express = require('express');
const multer = require('multer');
const router = express.Router();
const path = require('path');

// Configure Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// Dashboard Page
router.get('/', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    res.render('dashboard', { session: req.session }); // Pass session data to the template
  });

// File Upload Page
router.get('/upload', (req, res) => {
  res.render('uploaded-files');
});

const { createWorker } = require('tesseract.js');

// Handle File Upload with OCR
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const { user } = req.session;

  // Perform OCR on the uploaded file
  const worker = createWorker();
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');

  const { data: { text } } = await worker.recognize(req.file.path);
  await worker.terminate();

  // Save file details and extracted text to MongoDB (optional)
  const fileDetails = {
    fileName: req.file.filename,
    filePath: req.file.path,
    uploadedBy: user.username,
    uploadedAt: new Date(),
    extractedText: text,
  };

  // Notify Akshya center (mock implementation)
  console.log(`File uploaded by ${user.username}: ${req.file.filename}`);
  console.log('Extracted Text:', text);

  res.send(`File uploaded successfully! Extracted text: ${text}`);
});

module.exports = router;