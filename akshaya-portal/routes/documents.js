const express        = require('express');
const path           = require('path');
// const Document    = require('../models/Document'); // Document model likely not needed here anymore
const ServiceRequest = require('../models/ServiceRequest');
const router         = express.Router();

// Render Continue Application - MODIFIED
router.get('/continue-application/:serviceRequestId', async (req, res) => {
  // REMOVED: Session check depends on your auth strategy, keep if necessary
  // if (!req.session.user) return res.redirect('/');

  try {
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) {
        return res.status(404).send('Service request not found.');
    }

    // Directly map the data from the subdocuments
    const processedDocuments = serviceRequest.requiredDocuments.map(doc => {
      // This assumes 'extractedFields' might exist on the subdocument,
      // even if not explicitly in the schema provided earlier.
      // It gracefully handles cases where it's missing.
      return {
        _id:            doc._id,          // Subdocument ID
        name:           doc.name,         // Name from subdocument
        base64Data:     doc.fileData || null, // Base64 data from subdocument
        extractedFields: doc.extractedFields || {} // Extracted fields from subdoc (handles absence)
      };
    });

    // MODIFIED: Removed customer details from session
    res.render('continueApplication', {
      serviceRequest: {
        _id:               serviceRequest._id,
        status:            serviceRequest.status,
        // --- MODIFICATION START ---
        // Format documentType directly here: snake_case to Title Case
        documentType:      serviceRequest.documentType
                            ? serviceRequest.documentType.split('_') // Split by underscore
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter, lowercase rest
                                .join(' ') // Join with space
                            : "Service Request Details", // Fallback if documentType is missing
        // --- MODIFICATION END ---
        requiredDocuments: processedDocuments,
      }
    });

  } catch (err) {
    console.error('Error in /continue-application:', err);
    res.status(500).send('Something went wrong.');
  }
});

// Download base64 file - UNCHANGED (already correct based on previous fix)
router.get('/download/:serviceRequestId/:docSubId', async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).send('Service request not found.');
    }
    const doc = serviceRequest.requiredDocuments.id(req.params.docSubId);
    if (!doc || !doc.fileData) {
      return res.status(404).send('Document not found or has no data.');
    }

    // Remove data URI prefix if present before decoding
    const base64Data = doc.fileData.startsWith('data:')
        ? doc.fileData.substring(doc.fileData.indexOf(',') + 1)
        : doc.fileData;

    const buffer = Buffer.from(base64Data, 'base64');

    // Basic MIME type detection (remains the same)
    let contentType = 'application/octet-stream'; let extension = 'bin';
    // Refined checks based on potential data URI prefix OR raw base64 start
    const fileDataStart = doc.fileData.substring(0, 30); // Check start of string
    if (fileDataStart.includes('image/jpeg') || fileDataStart.startsWith('/9j/')) {
        contentType = 'image/jpeg'; extension = 'jpg';
    } else if (fileDataStart.includes('image/png') || fileDataStart.startsWith('iVBOR')) {
        contentType = 'image/png'; extension = 'png';
    } else if (fileDataStart.includes('application/pdf')) {
        contentType = 'application/pdf'; extension = 'pdf';
    } // Add more checks if needed

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


// Update overall request status - UNCHANGED
router.post('/update-request-status/:serviceRequestId', async (req, res) => {
  try {
    const { status } = req.body;
    // Add validation if status is part of the enum
    const validStatuses = ServiceRequest.schema.path('status').enumValues;
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value provided.' });
    }

    const updatedRequest = await ServiceRequest.findByIdAndUpdate(
        req.params.serviceRequestId,
        { status },
        { new: true, runValidators: true } // Ensure validators run
    );

    if (!updatedRequest) {
        return res.status(404).json({ message: 'Service request not found.' });
    }

    res.json({ message: 'Request status updated successfully' });
  } catch (err) {
    console.error('Error updating request status:', err);
    // Check for validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({ message: `Validation failed: ${err.message}` });
    }
    res.status(500).json({ message: 'Failed to update request status' });
  }
});

module.exports = router;