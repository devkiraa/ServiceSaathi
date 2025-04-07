const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const router = express.Router();
const bodyParser = require('body-parser');
const app = express();


// Admin-created user route
router.post('/api/users', async (req, res) => {
  try {
    // Expecting: username (mobile number), phone, email, shopName, personName, password, role, type, centerId
    const { username,phone,email, shopName, personName, password, role, type, centerId,district } = req.body;
    
    // Check if user already exists (using mobile number as username)
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: 'Mobile number already registered' });
    }
    
    // Create new user with provided details
    const user = new User({
      username:phone,
      phone,
      email,
      shopName,
      personName,
      password,
      role,
      type,
      centerId,
      district
      
    });
    await user.save();
    
    // Create Centre record for CSC or Akshaya types
    if (type === 'akshaya' || type === 'csc') {
      const Centre = require('../models/Centre');
      const centre = new Centre({
        centreName: centerId,   // using centerId as the centre identifier
        ownerName: personName,
        contact: phone,
        phone,
        email,
        type,
        centerId,
        district,
        // Optionally, auto-approve admin-created centres or leave them pending:
        status: role === 'admin' ? 'approved' : 'pending'
      });
      await centre.save();
    }
    
    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Self Signup Route
router.post('/api/signup', async (req, res) => {
  try {
    // Expecting: phone, email, shopName, personName, password, type, centerId
    const { phone, email, shopName, personName, password, type, centerId,district} = req.body;
    
    // Use mobile number as the username
    const existingUser = await User.findOne({ username: phone });
    if (existingUser) {
      return res.status(400).json({ error: 'Mobile number already registered' });
    }
    
    // Create new user with role 'user'
    const user = new User({
      username: phone,
      phone,
      email,
      shopName,
      personName,
      password,
      type,
      centerId,
      district,
      role: 'user'
    });
    await user.save();
    
    // For both CSC and Akshaya types, create a Centre record (status pending)
    if (type === 'akshaya' || type === 'csc') {
      const Centre = require('../models/Centre');
      const centre = new Centre({
        centreName: centerId,
        ownerName: personName,
        contact: phone,
        phone,
        email,
        type,
        centerId,
        district,
        status: 'pending'
      });
      await centre.save();
    }
    
    res.status(201).json({ message: 'Signup successful. Await admin approval.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
})

 

// Login Route
router.post('/api/login', async (req, res) => {
  try {
    // Here, username is expected to be the mobile number
    const { username, password } = req.body;
    
    // Find the user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: 'Invalid mobile number or password' });
    }
    // Compare passwords
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid mobile number or password' });
    }
   
    // For non-admin users, ensure the centre is approved before login
    if (user.role !== 'admin' && user.centerId) {
      const Centre = require('../models/Centre');
      const centre = await Centre.findOne({ centreName: user.centerId });
      if (!centre || centre.status !== 'approved') {
        return res.status(400).json({ error: 'Your centre is not approved yet' });
      }
    }
    
    // Set session data
    req.session.user = {
        id: user._id,
        username: user.username,
        email:user.email,
        role: user.role,
        type: user.type,
        centerId: user.centerId, // include the centre identifier
        phone:user.phone,
        district:user.district
      };
    
    res.status(200).json({ message: 'Logged in successfully', role: user.role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Handle service update
/*router.post("/update-services", async (req, res) => {
  try {
      const { services } = req.body;

      // Convert checkbox data to boolean values
      const updatedServices = {};
      for (let key in services) {
          updatedServices[key] = services[key] === "true";
      }

      // Update the user document
      await User.updateOne(
          { username: "" }, // Example user
          { $set: { services: updatedServices } }
      );

      res.redirect("/profile");
  }
   catch (error) {
      console.error(error);
      res.status(500).send("Error updating services");
  }
}); */


router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
        return res.status(500).json({ success: false, message: "Logout failed" });
    }
    return res.json({ success: true, message: "Logged out successfully" });
  });
});

// Change Password Route
router.post('/api/change-password', async (req, res) => {
  console.log("Session data:", req.session.user); // Debugging: Print session data

  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: "Unauthorized access - Session not found" });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Compare entered current password with hashed password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password and save
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: "Password changed successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Database error: " + error.message });
  }
});


module.exports = router;