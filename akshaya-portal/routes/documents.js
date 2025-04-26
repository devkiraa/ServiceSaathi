const express        = require('express');
const path           = require('path');
const Document       = require('../models/Document');
const ServiceRequest = require('../models/ServiceRequest');
const router         = express.Router();

// Render Continue Application
router.get('/continue-application/:serviceRequestId', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) return res.status(404).send('Service request not found.');

    // --- MODIFICATION START ---
    // Directly map the data from the subdocuments
    const processedDocuments = serviceRequest.requiredDocuments.map(doc => {
      // Assuming 'extractedFields' should be part of the subdocument.
      // If it's stored differently, adjust accordingly.
      // If you haven't added 'extractedFields' to the subdocument schema yet, you might need to.
      // For now, let's assume it *should* be there or we handle its absence.
      return {
        _id:        doc._id,          // This is the subdocument ID
        name:       doc.name,         // Get name from subdocument
        base64Data: doc.fileData || null, // Get fileData from subdocument
        // If extraction results are stored elsewhere or not yet implemented for subdocs,
        // you might need a different approach for extractedFields.
        // For this example, let's assume it *could* be on the subdocument:
        extractedFields: doc.extractedFields || {} // Use extractedFields if it exists on subdoc
      };
    });
    // --- MODIFICATION END ---

    res.render('continueApplication', {
      customerName: req.session.user.name,
      mobile:       req.session.user.mobile,
      email:        req.session.user.email,
      address:      req.session.user.address,
      dob:          req.session.user.dob,
      serviceRequest: {
        _id:               serviceRequest._id,
        status:            serviceRequest.status,
        requiredDocuments: processedDocuments, // Use the correctly processed documents
      }
    });
  } catch (err) {
    console.error('Error in /continue-application:', err);
    res.status(500).send('Something went wrong.');
  }
});

// Download base64 file - MODIFIED ROUTE AND LOGIC
router.get('/download/:serviceRequestId/:docSubId', async (req, res) => { // Added serviceRequestId
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).send('Service request not found.');
    }

    // Find the specific subdocument using its _id
    const doc = serviceRequest.requiredDocuments.id(req.params.docSubId);

    if (!doc || !doc.fileData) { // Check if subdocument exists and has fileData
      return res.status(404).send('Document not found or has no data.');
    }

    const buffer = Buffer.from(doc.fileData, 'base64');

    // Basic MIME type detection (can be improved)
    let contentType = 'application/octet-stream'; // Default
    let extension = 'bin'; // Default extension
    // Very simple check based on common Base64 image prefixes
    if (doc.fileData.startsWith('data:image/jpeg;base64,') || doc.fileData.startsWith('/9j/')) { // JPEG check
        contentType = 'image/jpeg';
        extension = 'jpg';
    } else if (doc.fileData.startsWith('data:image/png;base64,') || doc.fileData.startsWith('iVBORw0KGgo=')) { // PNG Check
        contentType = 'image/png';
        extension = 'png';
    } else if (doc.fileData.startsWith('data:application/pdf;base64,')) { // PDF check
       contentType = 'application/pdf';
       extension = 'pdf';
    }
    // Add more checks if needed (GIF, etc.)

    // Clean the document name for the filename
    const safeName = doc.name ? doc.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_') : 'document';
    const filename = `${safeName}.${extension}`;

    res.set('Content-Type', contentType);
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);

  } catch (err) {
    console.error('Error downloading document:', err);
    res.status(500).send('Server error during download');
  }
});

// Update overall request status
router.post('/update-request-status/:serviceRequestId', async (req, res) => {
  try {
    const { status } = req.body;
    await ServiceRequest.findByIdAndUpdate(req.params.serviceRequestId, { status }, { new: true });
    res.json({ message: 'Request status updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update request status' });
  }
});

module.exports = router;