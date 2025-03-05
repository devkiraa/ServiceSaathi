const express = require('express');
const Centre = require('../models/Centre');
const router = express.Router();

// Admin dashboard route – only accessible to admins
router.get('/admin-dashboard', async (req, res) => {
    if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
    try {
      // Fetch centres (all) and counts
      const centres = await Centre.find(); 
      const counts = {
        total: centres.length,
        approved: centres.filter(c => c.status === 'approved').length,
        pending: centres.filter(c => c.status === 'pending').length,
        rejected: centres.filter(c => c.status === 'rejected').length
      };
      res.render('admin-dashboard', { centres, counts, user: req.session.user });
    } catch (error) {
      res.status(500).send(error.message);
    }
  });


// Approve centre route
router.get('/approve-centre/:id', async (req, res) => {
  try {
    await Centre.findByIdAndUpdate(req.params.id, { status: 'approved' });
    res.redirect('/admin-dashboard');
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Reject centre route
router.get('/reject-centre/:id', async (req, res) => {
  try {
    await Centre.findByIdAndUpdate(req.params.id, { status: 'rejected' });
    res.redirect('/admin-dashboard');
  } catch (error) {
    res.status(500).send(error.message);
  }
});

module.exports = router;
