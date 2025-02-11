const express = require('express');
const router = express.Router();
const AkshyaCenter = require('../models/AkshyaCenter');
const ServiceApplication = require('../models/ServiceApplication');

// Get Akshya Centers by Location
router.post('/centers', async (req, res) => {
  const { district, subdistrict } = req.body;

  try {
    const centers = await AkshyaCenter.find({ district, subdistrict });
    res.json(centers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching Akshya centers' });
  }
});

// Get Services by Akshya Center ID
router.post('/services', async (req, res) => {
  const { centerId } = req.body;

  try {
    const center = await AkshyaCenter.findById(centerId);
    if (!center) return res.status(404).json({ error: 'Akshya center not found' });

    res.json(center.services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error fetching services' });
  }
});

// Create a Service Application
router.post('/apply', async (req, res) => {
    const { userId, centerId, serviceName, requiredDocuments } = req.body;
  
    try {
      // Generate unique upload links for each document
      const documentUploadLinks = requiredDocuments.map((doc) => {
        const uniqueId = Date.now().toString(36); // Generate a unique ID
        return {
          documentName: doc,
          uploadLink: `http://localhost:3000/upload/${uniqueId}`,
        };
      });
  
      // Save the application in the database
      const application = new ServiceApplication({
        userId,
        akshyaCenterId: centerId,
        serviceName,
        requiredDocuments: documentUploadLinks.map((doc) => ({
          documentName: doc.documentName,
          filePath: null, // Will be updated after upload
        })),
      });
      await application.save();
  
      // Respond with the application ID and upload links
      res.json({
        message: 'Application created successfully',
        applicationId: application._id,
        documentUploadLinks,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Error creating application' });
    }
  });
  
module.exports = router;