const express = require('express');
const multer = require('multer');
const Document = require('../models/Document');
const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Document upload route
router.post('/api/documents', upload.array('files'), async (req, res) => {
  try {
    const document = new Document({
      serviceName: req.body.serviceName,
      customerName: req.body.customerName,
      contactNumber: req.body.contactNumber,
      files: req.files.map(file => file.path)
    });
    await document.save();
    res.sendStatus(200);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;
