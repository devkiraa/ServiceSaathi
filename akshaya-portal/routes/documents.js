const express        = require('express');
const path           = require('path');
const ServiceRequest = require('../models/ServiceRequest');
const router         = express.Router();
const sharp          = require('sharp');
const moment         = require('moment');
// const fetch          = require('node-fetch'); // Comment out or remove this line
const axios          = require('axios'); // <--- USE AXIOS INSTEAD

// --- External API Configuration ---
const EXTRACTION_API_URL = 'https://servicesaathide.savishkaara.in/process';
// Add API Key here if needed, e.g., const EXTRACTION_API_KEY = 'YOUR_API_KEY';

// Render Continue Application route (remains the same)
router.get('/continue-application/:serviceRequestId', async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) return res.status(404).send('Service request not found.');

    const processedDocuments = serviceRequest.requiredDocuments.map(doc => ({
        _id:             doc._id,
        name:            doc.name,
        base64Data:      doc.fileData || null,
        extractedFields: doc.extractedFields || {},
        extractionDone:  doc.extractionDone || false
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
  } catch (err) {
      console.error("Error loading application:", err);
      res.status(500).send('Error loading application.');
   }
});

// --- Route for Triggering Extraction and Saving Data ---
router.post('/extract-and-save/:serviceRequestId/:docSubId', async (req, res) => {
    const { serviceRequestId, docSubId } = req.params;

    try {
        // 1. Find the Service Request and the specific Document (remains the same)
        const serviceRequest = await ServiceRequest.findById(serviceRequestId);
        if (!serviceRequest) {
            return res.status(404).json({ message: 'Service request not found.' });
        }
        const doc = serviceRequest.requiredDocuments.id(docSubId);
        if (!doc) {
            return res.status(404).json({ message: 'Document not found within the request.' });
        }
        if (!doc.fileData) {
             return res.status(400).json({ message: 'Document image data is missing.' });
        }
         if (doc.extractionDone) {
             return res.status(400).json({ message: 'Extraction already performed for this document.' });
        }

        // 2. Prepare data for the external API (remains the same)
        const requestBody = {
            document_type: doc.name,
            base64_image: doc.fileData
        };

        // --- 3. Call the External Extraction API using AXIOS ---
        console.log(`Calling extraction API for doc: ${doc.name} (${docSubId}) using axios`);

        // Axios automatically handles JSON stringification and parsing
        // It also throws an error for non-2xx status codes by default
        const apiResponse = await axios.post(EXTRACTION_API_URL, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                // Add Authorization header if needed
                // 'Authorization': `Bearer ${EXTRACTION_API_KEY}`
            },
            // Add timeout if needed (in milliseconds)
            // timeout: 30000
        });

        // If the request succeeds (status 2xx), the data is in apiResponse.data
        const extractedData = apiResponse.data;
        console.log(`Extraction API response for ${docSubId}:`, extractedData);

        // --- End Axios Call ---


        // Basic validation of extracted data (remains the same)
        if (typeof extractedData !== 'object' || extractedData === null) {
             console.warn(`Extraction API for ${docSubId} returned non-object data:`, extractedData);
             throw new Error('Extraction API returned invalid data format.');
        }

        // 4. Save the extracted data to the database (remains the same)
        const updateResult = await ServiceRequest.updateOne(
            { "_id": serviceRequestId, "requiredDocuments._id": docSubId },
            {
                $set: {
                    "requiredDocuments.$.extractedFields": extractedData,
                    "requiredDocuments.$.extractionDone": true
                }
            }
        );

        if (updateResult.nModified === 0 && updateResult.matchedCount === 1) {
             console.warn(`Document ${docSubId} found but not modified. Maybe data was the same?`);
         } else if (updateResult.matchedCount === 0) {
             throw new Error('Failed to find the document during the update phase.');
         }

        console.log(`Successfully saved extracted data for doc ${docSubId}`);

        // 5. Respond to the frontend (remains the same)
        res.status(200).json({
            message: 'Extraction successful and data saved.',
            savedData: extractedData
        });

    } catch (error) {
        // Axios wraps HTTP errors, check if it's an axios error
        let errorMessage = error.message || 'Server error during extraction process.';
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          errorMessage = `External API failed with status ${error.response.status}. ${JSON.stringify(error.response.data).substring(0,100)}`;
        } else if (error.request) {
          // The request was made but no response was received
          console.error("Axios Request Error:", error.request);
          errorMessage = 'No response received from external API.';
        }

        res.status(500).json({ message: errorMessage });
    }
});


// Download Route (Convertible) - Keep as is (remains the same)
router.get('/download-convert/:serviceRequestId/:docSubId', async (req, res) => {
    // ... (download logic remains unchanged) ...
    try {
        const { serviceRequestId, docSubId } = req.params;
        const requestedFormat = req.query.format?.toLowerCase();
        const requestedFilename = req.query.filename;

        if (!['jpg', 'png'].includes(requestedFormat)) {
             return res.status(400).send('Unsupported format requested. Only JPG and PNG are currently supported.');
        }

        const serviceRequest = await ServiceRequest.findById(serviceRequestId);
        if (!serviceRequest) return res.status(404).send('Service request not found.');

        const doc = serviceRequest.requiredDocuments.id(docSubId);
        if (!doc || !doc.fileData) return res.status(404).send('Document data not found.');

        const base64Data = doc.fileData.startsWith('data:')
            ? doc.fileData.substring(doc.fileData.indexOf(',') + 1)
            : doc.fileData;
        const originalBuffer = Buffer.from(base64Data, 'base64');

        let outputBuffer;
        let outputContentType;
        const targetExtension = requestedFormat === 'jpg' ? 'jpg' : 'png';

        try {
            const image = sharp(originalBuffer);
            const metadata = await image.metadata().catch(() => null);
            if (!metadata || metadata.format === 'pdf') {
                if (requestedFormat === 'pdf') {
                     outputBuffer = originalBuffer;
                     outputContentType = 'application/pdf';
                 } else {
                     return res.status(400).send('Conversion from PDF to image is not supported.');
                 }
            } else {
                 if (requestedFormat === 'jpg') {
                    outputBuffer = await image.jpeg().toBuffer();
                    outputContentType = 'image/jpeg';
                } else {
                    outputBuffer = await image.png().toBuffer();
                    outputContentType = 'image/png';
                }
            }
        } catch (conversionError) {
            console.error('Sharp conversion error:', conversionError);
            return res.status(500).send(`Failed to convert document. Original format might be unsupported. Error: ${conversionError.message}`);
        }

        let finalFilename;
        if (requestedFilename) {
            const baseName = requestedFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.[^/.]+$/, "");
            finalFilename = `${baseName}.${targetExtension}`;
        } else {
            const safeName = doc.name ? doc.name.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.[^/.]+$/, "") : 'document';
            const timestamp = moment().format('YYYYMMDD_HHmmss');
            finalFilename = `${safeName}_${timestamp}.${targetExtension}`;
        }

        res.set('Content-Type', outputContentType);
        res.set('Content-Disposition', `attachment; filename="${finalFilename}"`);
        res.send(outputBuffer);

    } catch (err) {
        console.error('Error during convertible download:', err);
        res.status(500).send('Server error during download process.');
    }
});

// Update overall request status route - Keep as is (remains the same)
router.post('/update-request-status/:serviceRequestId', async (req, res) => {
    // ... (status update logic remains unchanged) ...
     try {
        const { status } = req.body;
        const validStatuses = ServiceRequest.schema.path('status').enumValues;

        if (!validStatuses || !validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status value provided.' });
        }

        const updatedRequest = await ServiceRequest.findByIdAndUpdate(
            req.params.serviceRequestId,
            { status: status },
            { new: true, runValidators: true }
        );

        if (!updatedRequest) {
            return res.status(404).json({ message: 'Service request not found.' });
        }
        res.json({ message: 'Status updated successfully', updatedRequest: { status: updatedRequest.status } });

    } catch (err) {
        console.error("Error updating status:", err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: `Validation failed: ${err.message}` });
        }
        res.status(500).json({ message: 'Failed to update status due to server error.' });
    }
});


module.exports = router;