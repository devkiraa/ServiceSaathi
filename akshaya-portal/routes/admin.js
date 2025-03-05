const express = require('express');
const Centre = require('../models/Centre');
const router = express.Router();

// Admin dashboard route – only accessible to admins
router.get('/admin-dashboard', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  try {
    const centres = await Centre.find({ status: 'pending' });
    res.render('admin-dashboard', { centres, user: req.session.user });
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
