// routes/serviceAdmin.js
const express = require('express');
const router = express.Router();
const Service = require('../models/Service');

// GET: Render "Add New Service" form
router.get('/services/new', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  res.render('newService', { error: null, formData: {}, user: req.session.user, });
});

// GET: Render "Add New Service" form
router.get('/view-services', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  const services = await Service.find({ });
  res.render('allServices', { error: null, user: req.session.user, services });
});

// GET: Render "Edit Service" form
router.get('/edit-service/:id', async (req, res) => {
  try {
    // Check if the user is logged in and is an admin
    if (!req.session.user || req.session.user.role !== 'admin') {
      return res.redirect('/');
    }

    // Find the service by ID
    const serviceId = req.params.id;
    const service = await Service.findById(serviceId);

    // Handle case where the service is not found
    if (!service) {
      return res.status(404).render('error', { 
        error: 'Service not found', 
        user: req.session.user 
      });
    }

    // Render the "Edit Service" page with the service data
    res.render('editService', { 
      error: null, 
      user: req.session.user, 
      service 
    });
      
  } catch (err) {
    console.error(err);
    res.status(500).render('error', { 
      error: 'An unexpected error occurred', 
      user: req.session.user 
    });
  }
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


// POST: Handle updating an existing service
router.post('/edit-service/:id', async (req, res) => {
  const { id } = req.params; // Extract the service ID from the URL
  const { key, name, requiredDocuments } = req.body;

  // Normalize requiredDocuments to an array
  const docsArray = Array.isArray(requiredDocuments)
    ? requiredDocuments
    : [requiredDocuments];

  // Build the requiredDocuments objects, filtering out empty names
  const requiredDocs = docsArray
    .map(docName => docName.trim()) // Trim whitespace
    .filter(docName => docName) // Remove empty strings
    .map(docName => ({ name: docName })); // Convert to object format

  try {
    // Find the service by ID
    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Update the service fields
    service.key = key.trim().toLowerCase(); // Normalize key to lowercase
    service.name = name.trim(); // Trim whitespace from name
    service.requiredDocuments = requiredDocs; // Update required documents

    // Save the updated service
    await service.save();

    // Respond with success
    res.status(200).json({ message: 'Service updated successfully' });
  } catch (err) {
    console.error('Error updating service:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;
