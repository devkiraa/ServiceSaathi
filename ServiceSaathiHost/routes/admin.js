const express = require('express');
const router = express.Router();
const ServiceApplication = require('../models/ServiceApplication');

// Admin Dashboard Page
router.get('/', async (req, res) => {
  try {
    // Fetch all service applications from the database
    const applications = await ServiceApplication.find().populate('userId').populate('akshyaCenterId');

    // Render the Akshya Center dashboard with the applications data
    res.render('akshya-center-dashboard', { applications });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading admin dashboard');
  }
});

module.exports = router;