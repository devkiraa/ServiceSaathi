const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET route (already provided)
router.get('/profile', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  try {
    const user = await User.findOne({ _id: req.session.user.id });
    if (!user) return res.status(404).send("User not found");
    res.render('profile', {
      user: {
        _id: user._id,
        email: user.email,
        shopName: user.shopName,
        personName: user.personName,
        centerId: user.centerId,
        phone: user.phone,
        district: user.district,
        type: user.type,
        services: user.services,
        address: user.address.toObject()
      }
    });
  } catch (error) {
    res.status(500).send("Server error: " + error.message);
  }
});

// POST route to save updated profile data
router.put('/profile-update', async (req, res) => {
  if (!req.session.user) return res.status(401).send("Unauthorized");

  try {
    const userId = req.session.user.id; // Get the user ID from the session
    const {
      email,
      shopName,
      personName,
      phone,
      type,
      district,
      address,
      services
    } = req.body;

    // Find the user by ID
    const user = await User.findOne({ _id: userId });
    if (!user) return res.status(404).send("User not found");

    // Update the user's fields with the new data
    user.email = email;
    user.shopName = shopName;
    user.personName = personName;
    user.phone = phone;
    user.type = type;
    user.district = district;

    // Update nested address fields
    user.address.buildingName = address.buildingName;
    user.address.street = address.street;
    user.address.locality = address.locality;
    user.address.pincode = address.pincode;

    // Update services (checkboxes)
    user.services.income_certificate = services.income_certificate || false;
    user.services.voter_registration = services.voter_registration || false;
    user.services.passport_service = services.passport_service || false;
    user.services.utility_payments = services.utility_payments || false;
    user.services.possession_certificate = services.possession_certificate || false;

    // Save the updated user document
    await user.save();

    // Respond with success message
    res.status(200).json({ message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error: " + error.message });
  }
});

module.exports = router;