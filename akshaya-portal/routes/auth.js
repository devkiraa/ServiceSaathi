// routes/auth.js
const express   = require('express');
const router    = express.Router();
const User      = require('../models/User');
const Centre    = require('../models/Centre');
const bcrypt    = require('bcryptjs');

// Admin‑created user route
router.post('/api/users', async (req, res) => {
  try {
    // Now also expect subdistrict + address + services
    const {
      username,       // mobile number
      phone,
      email,
      shopName,
      personName,
      password,
      role,           // 'admin' or 'user'
      type,           // 'CSC' or 'Akshaya'
      centerId,
      district,
      subdistrict,
      buildingName,
      street,
      locality,
      pincode,
      // services flags
      income_certificate,
      voter_registration,
      passport_service,
      utility_payments,
      possession_certificate
    } = req.body;

    // check duplicate
    if (await User.findOne({ username: phone })) {
      return res.status(400).json({ error: 'Mobile number already registered' });
    }

    // build services object
    const services = {
      income_certificate:   !!income_certificate,
      voter_registration:   !!voter_registration,
      passport_service:     !!passport_service,
      utility_payments:     !!utility_payments,
      possession_certificate: !!possession_certificate
    };

    // create user
    const user = new User({
      username:   phone,
      phone,
      email,
      shopName,
      personName,
      password,
      role,
      type,
      centerId,
      district,
      subdistrict,
      services,
      address: {
        buildingName,
        street,
        locality,
        pincode: pincode ? Number(pincode) : null
      }
    });
    await user.save();

    // create centre if needed
    if (['csc','akshaya'].includes(type.toLowerCase())) {
      const centre = new Centre({
        centreName:  centerId,
        ownerName:   personName,
        contact:     phone,
        email,
        type:        type.toLowerCase(),
        centerId,
        district,
        subdistrict,
        services,
        status:      role === 'admin' ? 'approved' : 'pending'
      });
      await centre.save();
    }

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Public signup route
router.post('/api/signup', async (req, res) => {
  try {
    const {
      phone,
      email,
      shopName,
      personName,
      password,
      type,
      centerId,
      district,
      subdistrict,
      buildingName,
      street,
      locality,
      pincode,
      income_certificate,
      voter_registration,
      passport_service,
      utility_payments,
      possession_certificate
    } = req.body;

    if (await User.findOne({ username: phone })) {
      return res.status(400).json({ error: 'Mobile number already registered' });
    }

    const services = {
      income_certificate:   !!income_certificate,
      voter_registration:   !!voter_registration,
      passport_service:     !!passport_service,
      utility_payments:     !!utility_payments,
      possession_certificate: !!possession_certificate
    };

    const user = new User({
      username:   phone,
      phone,
      email,
      shopName,
      personName,
      password,
      role:       'user',
      type,
      centerId,
      district,
      subdistrict,
      services,
      address: {
        buildingName,
        street,
        locality,
        pincode: pincode ? Number(pincode) : null
      }
    });
    await user.save();

    if (['csc','akshaya'].includes(type.toLowerCase())) {
      const centre = new Centre({
        centreName:  shopName,
        ownerName:   personName,
        contact:     phone,
        email,
        type:        type.toLowerCase(),
        centerId,
        district,
        subdistrict,
        services,
        status:      'pending'
      });
      await centre.save();
    }

    res.status(201).json({ message: 'Signup successful. Await admin approval.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});
 

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
      const centre = await Centre.findOne({ centerId: user.centerId });
      if (!centre || centre.status !== 'approved') {
        return res.status(400).json({ error: 'Your centre is not approved yet' });
      }
    }
    
    // Set session data
    req.session.user = {
        pName: user.personName,
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

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: "Password changed successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Database error: " + error.message });
  }
});

module.exports = router;