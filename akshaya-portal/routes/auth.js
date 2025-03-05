const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Route to create a new user (admin-created via /api/users)
router.post('/api/users', async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    // Check if user exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create new user with provided role
    const user = new User({ username, password, role, phone: '', type: 'cse' });
    await user.save();
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Signup Route (for self signup)
router.post('/api/signup', async (req, res) => {
    try {
      const { email, phone, password, type, centerId } = req.body;
      // Check if user exists (using email as username)
      const existingUser = await User.findOne({ username: email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      // Create new user with role 'user'
      const user = new User({
        username: email,
        phone,
        password,
        type,
        centerId,
        role: 'user'
      });
      await user.save();
  
      // For both cse and akshaya types, create a Centre record
      if (type === 'akshaya' || type === 'csc') {
        const Centre = require('../models/Centre');
        const centre = new Centre({
          centreName: centerId,       // using the centerId field as centre identifier/name
          ownerName: email,           // using the email as a placeholder for owner name
          contact: phone,
          status: 'pending'
        });
        await centre.save();
      }
      
      res.status(201).json({ message: 'Signup successful. Await admin approval.' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  
// Login route to authenticate users
// Login Route
router.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      // Find the user
      const user = await User.findOne({ username });
      if (!user) {
        return res.status(400).json({ error: 'Invalid username or password' });
      }
      // Compare passwords
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid username or password' });
      }
      
      // For non-admin users with a centre record, ensure the centre is approved before login.
      // (Assumes that non-admin users have a "centerId" field and a corresponding Centre document.)
      if (user.role !== 'admin' && user.centerId) {
        const Centre = require('../models/Centre');
        const centre = await Centre.findOne({ centreName: user.centerId });
        if (!centre || centre.status !== 'approved') {
          return res.status(400).json({ error: 'Your centre is not approved yet' });
        }
      }
      
      // Set session
      req.session.user = { id: user._id, username: user.username, role: user.role, type: user.type };
      res.status(200).json({ message: 'Logged in successfully', role: user.role });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });  
module.exports = router;