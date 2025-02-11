const express = require('express');
const router = express.Router();
const User = require('../models/User');
const AkshyaCenter = require('../models/AkshyaCenter');
const ServiceApplication = require('../models/ServiceApplication');

// Endpoint for WhatsApp bot to create a user session
router.post('/start-session', async (req, res) => {
  const { phoneNumber, languagePreference } = req.body;

  try {
    // Check if the user already exists
    let user = await User.findOne({ username: phoneNumber });
    if (!user) {
      // Create a new user
      user = new User({
        username: phoneNumber,
        password: 'default-password', // Default password (can be updated later)
      });
      await user.save();
    }

    res.json({
      message: 'Session started successfully',
      userId: user._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error starting session' });
  }
});

// Endpoint for WhatsApp bot to fetch Akshya centers by location
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

// Endpoint for WhatsApp bot to create a service application
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