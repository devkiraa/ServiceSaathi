const express        = require('express');
const path           = require('path'); // Needed for extension handling
const ServiceRequest = require('../models/ServiceRequest');
const router         = express.Router();
const sharp          = require('sharp'); // Require sharp
const moment         = require('moment'); // For server-side timestamp fallback

// Render Continue Application route (remains the same as previous version)
router.get('/continue-application/:serviceRequestId', async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) return res.status(404).send('Service request not found.');

    const processedDocuments = serviceRequest.requiredDocuments.map(doc => ({
        _id:            doc._id,
        name:           doc.name,
        base64Data:     doc.fileData || null, // Pass raw base64 needed for client-side size calc
        extractedFields: doc.extractedFields || {}
    }));

    res.render('continueApplication', {
      serviceRequest: {
        _id:               serviceRequest._id,
        status:            serviceRequest.status,
        documentType:      serviceRequest.documentType
                            ? serviceRequest.documentType.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
                            : "Service Request Details",
        requiredDocuments: processedDocuments,
      }
    });
  } catch (err) { console.error(err); res.status(500).send('Error loading application.'); }
});


// --- NEW Route for Convertible Download ---
router.get('/download-convert/:serviceRequestId/:docSubId', async (req, res) => {
  try {
    const { serviceRequestId, docSubId } = req.params;
    const requestedFormat = req.query.format?.toLowerCase(); // e.g., 'jpg', 'png'
    const requestedFilename = req.query.filename; // Filename from user input (without extension)

    // Basic validation
    if (!['jpg', 'png'].includes(requestedFormat)) { // Only support JPG/PNG for now
      return res.status(400).send('Unsupported format requested. Only JPG and PNG are currently supported.');
    }

    const serviceRequest = await ServiceRequest.findById(serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).send('Service request not found.');
    }

    const doc = serviceRequest.requiredDocuments.id(docSubId);
    if (!doc || !doc.fileData) {
      return res.status(404).send('Document data not found.');
    }

    // Decode Base64 (handle potential data URI)
    const base64Data = doc.fileData.startsWith('data:')
        ? doc.fileData.substring(doc.fileData.indexOf(',') + 1)
        : doc.fileData;

    const originalBuffer = Buffer.from(base64Data, 'base64');

    let outputBuffer;
    let outputContentType;
    const targetExtension = requestedFormat === 'jpg' ? 'jpg' : 'png'; // Determine target extension

    // --- Conversion Logic ---
    try {
        const image = sharp(originalBuffer);
        // Check if input is potentially PDF - sharp might throw error
        const metadata = await image.metadata().catch(() => null); // Suppress error if not image
        if (!metadata || metadata.format === 'pdf') {
             // If original is PDF, conversion to image is not supported here
             if (requestedFormat === 'pdf') { // Allow PDF -> PDF download (no conversion needed)
                 outputBuffer = originalBuffer;
                 outputContentType = 'application/pdf';
                 // targetExtension = 'pdf'; // If PDF output is enabled
             } else {
                 return res.status(400).send('Conversion from PDF to image is not supported.');
             }
        } else {
            // Perform image conversion
            if (requestedFormat === 'jpg') {
                outputBuffer = await image.jpeg().toBuffer();
                outputContentType = 'image/jpeg';
            } else { // png
                outputBuffer = await image.png().toBuffer();
                outputContentType = 'image/png';
            }
        }
    } catch (conversionError) {
      console.error('Sharp conversion error:', conversionError);
      // Attempt to serve original if conversion fails? Or just error out.
      // Let's error out clearly for now.
      return res.status(500).send(`Failed to convert document. Original format might be unsupported. Error: ${conversionError.message}`);
    }
    // --- End Conversion Logic ---


    // --- Filename Generation ---
    let finalFilename;
    if (requestedFilename) {
      // Sanitize and add the correct target extension
      const baseName = requestedFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.[^/.]+$/, ""); // Remove existing ext
      finalFilename = `${baseName}.${targetExtension}`;
    } else {
      // Default filename if not provided by user
      const safeName = doc.name ? doc.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.[^/.]+$/, "") : 'document';
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      finalFilename = `${safeName}_${timestamp}.${targetExtension}`;
    }
    // --- End Filename Generation ---

    // Set headers and send response
    res.set('Content-Type', outputContentType);
    res.set('Content-Disposition', `attachment; filename="${finalFilename}"`);
    res.send(outputBuffer);

  } catch (err) {
    console.error('Error during convertible download:', err);
    res.status(500).send('Server error during download process.');
  }
});


// --- REMOVE or COMMENT OUT the old direct download route ---
/*
router.get('/download/:serviceRequestId/:docSubId', async (req, res) => {
  // ... (old direct download logic) ...
});
*/

// Update overall request status (remains the same)
router.post('/update-request-status/:serviceRequestId', async (req, res) => {
    // ... (previous status update logic) ...
     try {
        const { status } = req.body;
        const validStatuses = ServiceRequest.schema.path('status').enumValues;
        if (!validStatuses.includes(status)) return res.status(400).json({ message: 'Invalid status value.' });
        const updatedRequest = await ServiceRequest.findByIdAndUpdate(req.params.serviceRequestId, { status }, { new: true, runValidators: true });
        if (!updatedRequest) return res.status(404).json({ message: 'Not found.' });
        res.json({ message: 'Status updated successfully' });
    } catch (err) {
        console.error(err);
        if (err.name === 'ValidationError') return res.status(400).json({ message: `Validation failed: ${err.message}` });
        res.status(500).json({ message: 'Failed to update status' });
    }
});

module.exports = router;