const express = require('express');
const router = express.Router();
const User = require('../models/User');

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

module.exports = router;