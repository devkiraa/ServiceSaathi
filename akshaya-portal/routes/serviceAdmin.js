// routes/serviceAdmin.js
const express = require('express');
const router = express.Router();
const Service = require('../models/Service');

// GET: Render "Add New Service" form
router.get('/services/new', (req, res) => {
  res.render('newService', { error: null, formData: {} });
});

// POST: Handle creation of a new service
router.post('/services', async (req, res) => {
  const { key, name, requiredDocuments } = req.body;
  // Normalize requiredDocuments to an array
  const docsArray = Array.isArray(requiredDocuments)
    ? requiredDocuments
    : [requiredDocuments];

  // Build the requiredDocuments objects, filtering out empty names
  const requiredDocs = docsArray
    .map(docName => docName.trim())
    .filter(docName => docName)
    .map(docName => ({ name: docName }));

  try {
    const service = new Service({
      key: key.trim().toLowerCase(),
      name: name.trim(),
      requiredDocuments: requiredDocs
    });
    await service.save();
    // Redirect to a listing page or show success message
    res.redirect('/services/new');
  } catch (err) {
    console.error('Error creating service:', err);
    // Re-render form with error and previous input
    res.render('services/new', { error: err.message, formData: req.body });
  }
});

module.exports = router;
