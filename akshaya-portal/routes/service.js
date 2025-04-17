const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Service = require('../models/Service');
const ServiceRequest = require('../models/ServiceRequest');
const Centre = require('../models/Centre'); // To check centre details
const multer = require('multer'); // You'll still need multer for handling file uploads
dotenv.config(); // Load environment variables if not already loaded

// --- Middleware for handling file uploads (without GridFS) ---
const storage = multer.memoryStorage(); // Store file in memory as a buffer
const upload = multer({ storage: storage });

// --- Create a new service request ---
router.post('/service-request', async (req, res) => {
  try {
    const { 'document-type': documentType, 'centre-id': centreId } = req.body;

    // 1. Verify that the centre exists and is approved.
    const centre = await Centre.findOne({ centerId: centreId });
    if (!centre) {
      return res.status(400).json({ error: 'Centre not found' });
    }
    if (centre.status !== 'approved') {
      return res.status(400).json({ error: 'Centre not approved' });
    }

    // 2. Fetch service definition from DB
    const service = await Service.findOne({ key: documentType });
    if (!service) {
      return res.status(400).json({ error: 'Invalid document type' });
    }

    // 3. Build the payload for insertion (no _id yet)
    const initialDocs = service.requiredDocuments.map(doc => ({
      name: doc.name,
      uploadedFile: null,
      fileData: null
    }));

    // 4. Generate upload token & save the ServiceRequest
    const uploadToken = crypto.randomBytes(16).toString('hex');
    const serviceRequest = new ServiceRequest({
      documentType,
      centreId,
      requiredDocuments: initialDocs,
      status: 'started',
      uploadToken
    });
    await serviceRequest.save();

    // 5. Now serviceRequest.requiredDocuments has _id on each subdoc
    const responseDocs = serviceRequest.requiredDocuments;

    // 6. Respond with those subdocs (with _id)
    const uploadLink = `${req.protocol}://${req.get('host')}/sendimage/${uploadToken}`;
    res.status(201).json({
      message: 'Service request created successfully',
      serviceRequestId: serviceRequest._id,
      requiredDocuments: responseDocs,   // ← contains the _id fields now
      uploadLink
    });

  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Request reupload for a specific document ---
router.post('/service-request/:id/reupload', async (req, res) => {
  try {
    const { id } = req.params;
    const { documentId } = req.body; // subdoc _id to reupload
    const serviceRequest = await ServiceRequest.findById(id);
    if (!serviceRequest) return res.status(404).json({ error: 'Service request not found' });

    const doc = serviceRequest.requiredDocuments.id(documentId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Mark for reupload and clear existing data
    doc.uploadedFile = null;
    doc.fileData = null;
    doc.needsReupload = true;
    serviceRequest.status = 'reupload_required';

    await serviceRequest.save();
    res.json({ message: 'Reupload requested', documentId, serviceRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// --- Get service request details ---
router.get('/service-request/:id', async (req, res) => {
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
// --- Upload Documents (Storing as Base64) ---
router.post('/upload-documents/:serviceRequestId', upload.array('files', 10), async (req, res) => {
  try {
    const { serviceRequestId } = req.params;
    const files = req.files;
    const serviceRequest = await ServiceRequest.findById(serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).json({ error: "Service request not found" });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No files were uploaded." });
    }

    // For each uploaded file, store its data as Base64 in the corresponding requiredDocuments entry.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (serviceRequest.requiredDocuments[i]) {
        const buffer = file.buffer;
        const base64String = buffer.toString('base64');
        serviceRequest.requiredDocuments[i].uploadedFile = file.originalname; // Store original filename
        serviceRequest.requiredDocuments[i].fileData = base64String; // Store Base64 encoded data
      }
    }

    // Update status to "submitted"
    serviceRequest.status = "submitted";
    await serviceRequest.save();
    res.status(200).json({ message: "Documents uploaded successfully", serviceRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// --- Update Application Status ---
router.post('/application-status/:serviceRequestId', async (req, res) => {
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
// --- Serving Files (from Base64 data) ---
router.get('/files/:serviceRequestId/:documentIndex', async (req, res) => {
  try {
    const { serviceRequestId, documentIndex } = req.params;
    const serviceRequest = await ServiceRequest.findById(serviceRequestId);

    if (!serviceRequest || !serviceRequest.requiredDocuments[documentIndex]) {
      return res.status(404).json({ error: 'File not found' });
    }

    const document = serviceRequest.requiredDocuments[documentIndex];
    if (!document.fileData) {
      return res.status(404).json({ error: 'File data not available' });
    }

    // Determine content type based on filename (you might need a more robust way)
    let contentType = 'application/octet-stream';
    if (document.uploadedFile && document.uploadedFile.endsWith('.pdf')) {
      contentType = 'application/pdf';
    } else if (document.uploadedFile && (document.uploadedFile.endsWith('.jpg') || document.uploadedFile.endsWith('.jpeg'))) {
      contentType = 'image/jpeg';
    } else if (document.uploadedFile && document.uploadedFile.endsWith('.png')) {
      contentType = 'image/png';
    }

    const base64Data = document.fileData;
    const buffer = Buffer.from(base64Data, 'base64');

    res.set('Content-Type', contentType);
    res.send(buffer);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// --- Render applyService page using token ---
router.get('/sendimage/:uploadToken', async (req, res) => {
  try {
    const { uploadToken } = req.params;
    const serviceRequest = await ServiceRequest.findOne({ uploadToken });
    if (!serviceRequest) {
      return res.status(404).send("Invalid upload token.");
    }
    const centre = await Centre.findOne({ centerId: serviceRequest.centreId });
    if (!centre) {
      return res.status(404).send("Associated centre not found.");
    }
    res.render('applyService', { serviceRequest });
  } catch (error) {
    res.status(500).send("Server error: " + error.message);
  }
});
router.get('/ping', (req, res) => res.json({ ok: true }));
module.exports = router;