// routes/service.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Service = require('../models/Service');
const ServiceRequest = require('../models/ServiceRequest');
const Centre = require('../models/Centre');
const multer = require('multer');

dotenv.config();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.get('/services', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  try {
    const user = await User.findOne({ _id: req.session.user.id });
    if (!user) return res.status(404).send("User not found");

    const serviceRequests = await ServiceRequest.find({ centreId: user.centerId });
    res.render('services', {
      user: {
        email: user.email,
        shopName: user.shopName,
        personName: user.personName,
        centerId: user.centerId,
        phone: user.phone,
        district: user.district,
        type: user.type,
        services: user.services,
        address: user.address.toObject()
      },
      serviceRequests: serviceRequests.map(sr => ({
        _id: sr._id,
        documentType: sr.documentType,
        mobileNumber: sr.mobileNumber,
        status: sr.status,
        action: sr.action,
        applicationDate: sr.createdAt
      }))
    });
  } catch (error) {
    console.error("Error fetching user or data:", error);
    res.status(500).send("Server error: " + error.message);
  }
});

router.post('/service-request', async (req, res) => {
  try {
    const {
      'document-type': documentType,
      'centre-id': centreId,
      'mobile-number': mobileNumber
    } = req.body;

    const centre = await Centre.findOne({ centerId: centreId });
    if (!centre) return res.status(400).json({ error: 'Centre not found' });
    if (centre.status !== 'approved') return res.status(400).json({ error: 'Centre not approved' });

    const service = await Service.findOne({ key: documentType });
    if (!service) return res.status(400).json({ error: 'Invalid document type' });

    const initialDocs = service.requiredDocuments.map(doc => ({
      name: doc.name,
      uploadedFile: "",
      fileData: ""
    }));

    const uploadToken = crypto.randomBytes(16).toString('hex');
    const serviceRequest = new ServiceRequest({
      documentType,
      centreId,
      mobileNumber,
      requiredDocuments: initialDocs,
      status: 'documents-uploading',
      uploadToken
    });
    await serviceRequest.save();

    const responseDocs = serviceRequest.requiredDocuments;
    const uploadLink = `https://${req.get('host')}/sendimage/${uploadToken}`;
    res.status(201).json({
      message: 'Service request created successfully',
      serviceRequestId: serviceRequest._id,
      requiredDocuments: responseDocs,
      uploadLink
    });
  } catch (error) {
    console.error('Error creating service request:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/service-request/:id/reupload', async (req, res) => {
  try {
    const { id } = req.params;
    const { documentId } = req.body;
    const serviceRequest = await ServiceRequest.findById(id);
    if (!serviceRequest) return res.status(404).json({ error: 'Service request not found' });

    const doc = serviceRequest.requiredDocuments.id(documentId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    doc.uploadedFile = "";
    doc.fileData = "";
    doc.needsReupload = true;
    serviceRequest.status = 'reupload_required';

    await serviceRequest.save();
    res.json({ message: 'Reupload requested', documentId, serviceRequest });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Continue Application Route (Fixed)
router.get('/continue-application/:serviceRequestId', async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).send("Service request not found.");
    }

    // Populate customer details from session if available
    const customer = req.session.user || {};

    res.render('continueApplication', {
      customerName: customer.name || "",
      mobile: customer.mobile || "",
      email: customer.email || "",
      address: customer.address || "",
      dob: customer.dob || "",
      serviceRequest: serviceRequest
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

router.get('/service-request/:id', async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.id);
    if (!serviceRequest) return res.status(404).json({ error: "Service request not found" });
    res.status(200).json(serviceRequest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post(
  '/upload-documents/:serviceRequestId',
  upload.array('files', 10),
  async (req, res) => {
    try {
      const { serviceRequestId } = req.params;
      const files = req.files;
      const serviceRequest = await ServiceRequest.findById(serviceRequestId);
      if (!serviceRequest) return res.status(404).json({ error: "Service request not found" });

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files were uploaded." });
      }

      files.forEach((file, i) => {
        if (serviceRequest.requiredDocuments[i]) {
          const b64 = file.buffer.toString('base64');
          serviceRequest.requiredDocuments[i].uploadedFile = file.originalname;
          serviceRequest.requiredDocuments[i].fileData = b64;
        }
      });

      serviceRequest.status = "submitted";
      await serviceRequest.save();
      return res.json({ message: "Documents uploaded successfully", serviceRequest });
    } catch (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ error: err.message });
    }
  }
);

router.post('/application-status/:serviceRequestId', async (req, res) => {
  try {
    const { status } = req.body;
    if (!["completed","started","documents-uploading"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) return res.status(404).json({ error: "Service request not found" });
    serviceRequest.status = status;
    await serviceRequest.save();
    res.status(200).json({ message: "Application status updated successfully", serviceRequest });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
    let contentType = 'application/octet-stream';
    if (document.uploadedFile.endsWith('.pdf')) contentType = 'application/pdf';
    else if (document.uploadedFile.match(/\.(jpe?g)$/)) contentType = 'image/jpeg';
    else if (document.uploadedFile.endsWith('.png')) contentType = 'image/png';

    const buffer = Buffer.from(document.fileData, 'base64');
    res.set('Content-Type', contentType);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sendimage/:uploadToken', async (req, res) => {
  try {
    const { uploadToken } = req.params;
    const serviceRequest = await ServiceRequest.findOne({ uploadToken });
    if (!serviceRequest) return res.status(404).send("Invalid upload token.");
    const centre = await Centre.findOne({ centerId: serviceRequest.centreId });
    if (!centre) return res.status(404).send("Associated centre not found.");
    res.render('applyService', { serviceRequest });
  } catch (error) {
    res.status(500).send("Server error: " + error.message);
  }
});

// GET by mobile number
router.get('/service-request/phone/:mobileNumber', async (req, res) => {
  try {
    const { mobileNumber } = req.params;
    const requests = await ServiceRequest.find({ mobileNumber });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/service-request/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const serviceRequest = await ServiceRequest.findById(id, 'status');
    if (!serviceRequest) return res.status(404).json({ error: 'Service request not found' });

    res.json({ status: serviceRequest.status });
  } catch (error) {
    console.error("Error fetching service request status:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel a service request by ID
router.post('/service-request/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const serviceRequest = await ServiceRequest.findById(id);

    if (!serviceRequest) {
      return res.status(404).json({ error: 'Service request not found' });
    }

    await ServiceRequest.deleteOne({ _id: id });

    res.status(200).json({ message: 'Service request cancelled and deleted successfully' });
  } catch (error) {
    console.error('Error cancelling service request:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/ping', (req, res) => res.json({ ok: true }));

module.exports = router;