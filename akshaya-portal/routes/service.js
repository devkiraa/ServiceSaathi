const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const ServiceRequest = require('../models/ServiceRequest');
const Centre = require('../models/Centre'); // To check centre details

// POST /api/service-request
// Create a new service request (for example, Income Certificate)
// Expected payload: { "document-type": "Income-certificate", "centre-id": "689691" }
router.post('/api/service-request', async (req, res) => {
  try {
    const { "document-type": documentType, "centre-id": centreId } = req.body;
    
    // Verify that the centre exists and is approved.
    // Note: Ensure that your Centres model uses the field "centerId" (or adjust accordingly).
    const centre = await Centre.findOne({ centerId: centreId });
    if (!centre) {
      return res.status(400).json({ error: 'Centre not found' });
    }
    if (centre.status !== 'approved') {
      return res.status(400).json({ error: 'Centre not approved' });
    }
    
    // For demonstration, if documentType is "Income-certificate", then required documents are fixed.
    let requiredDocuments = [];
    if (documentType === "income_certificate") {
      requiredDocuments = [
        { name: "Aadhar Card", uploadedFile: "" },
        { name: "Ration Card", uploadedFile: "" },
        { name: "SSLC Book", uploadedFile: "" }
      ];
    }
    
    // Generate a random token for the upload link
    const uploadToken = crypto.randomBytes(16).toString('hex');

    // Create and save the service request with initial status "started"
    const serviceRequest = new ServiceRequest({
      documentType,
      centreId,
      requiredDocuments,
      status: "started",  // "started" must be allowed in your model's enum
      uploadToken
    });
    await serviceRequest.save();

    // Create the upload link using the generated token
    const uploadLink = req.protocol + '://' + req.get('host') + '/sendimage/' + uploadToken;
    
    res.status(201).json({
      message: 'Service request created successfully',
      serviceRequestId: serviceRequest._id,
      requiredDocuments: serviceRequest.requiredDocuments,
      uploadLink: uploadLink
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/service-request/:id
// Returns full service request details, including requiredDocuments.
router.get('/api/service-request/:id', async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.id);
    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }
    res.status(200).json(serviceRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ensure the upload directory exists
const uploadDir = 'uploads/service-documents/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer storage for document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// POST /api/upload-documents/:serviceRequestId
// Accept multiple file uploads for a given service request.
router.post('/api/upload-documents/:serviceRequestId', upload.array('files', 10), async (req, res) => {
  try {
    const { serviceRequestId } = req.params;
    const files = req.files;
    const serviceRequest = await ServiceRequest.findById(serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }
    // Assume the order of files corresponds to the order of requiredDocuments.
    files.forEach((file, index) => {
      if (serviceRequest.requiredDocuments[index]) {
        // Generate a URL for the image, e.g., http://localhost:3000/sendimage/<basename>
        const imageUrl = req.protocol + '://' + req.get('host') + '/sendimage/' + path.basename(file.path);
        serviceRequest.requiredDocuments[index].uploadedFile = imageUrl;
      }
    });
    // Update status after document upload. (You can choose "submitted" or let user update further.)
    serviceRequest.status = "received";
    await serviceRequest.save();
    res.status(200).json({ message: "Documents uploaded successfully", serviceRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/application-status/:serviceRequestId
// Update the application status to either "completed" or "started"
// (You can extend allowed statuses as needed.)
router.post('/api/application-status/:serviceRequestId', async (req, res) => {
  try {
    const { status } = req.body; // Expecting status: "completed" or "started"
    if (!["completed", "started"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }
    serviceRequest.status = status;
    await serviceRequest.save();
    res.status(200).json({ message: "Application status updated successfully", serviceRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /sendimage/:uploadToken
// Verifies the upload token and renders the applyService page.
router.get('/sendimage/:uploadToken', async (req, res) => {
  try {
    const { uploadToken } = req.params;
    // Find the service request based on the token
    const serviceRequest = await ServiceRequest.findOne({ uploadToken });
    if (!serviceRequest) {
      return res.status(404).send("Invalid upload token.");
    }
    // Verify that the associated centre exists.
    const centre = await Centre.findOne({ centerId: serviceRequest.centreId });
    if (!centre) {
      return res.status(404).send("Associated centre not found.");
    }
    // Render the applyService page if the token is valid.
    res.render('applyService', { serviceRequest });
  } catch (error) {
    res.status(500).send("Server error: " + error.message);
  }
});
router.get('/api/ping', (req, res) => res.json({ ok: true }));
module.exports = router;
