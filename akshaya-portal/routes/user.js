const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Adjust path as needed
const Centre    = require('../models/Centre');
const axios = require('axios');

// --- GET User Profile Route ---
// Fetches user data and the master list of services
router.get('/profile', async (req, res) => {
  // 1. Check Authentication
  if (!req.session.user || !req.session.user.id) {
    return res.redirect('/'); // Redirect to login if not authenticated
  }

  try {
    // 2. Fetch User Data
    const user = await User.findById(req.session.user.id); // Use findById
    if (!user) {
      console.warn(`User not found for ID: ${req.session.user.id}`);
      // Optionally redirect or show an error page
      return res.status(404).render('error', { message: 'User not found.' }); // Example error page
    }

    // 3. Fetch Master Service List
    let servicesList = []; // Default to empty array
    try {
        // IMPORTANT: Ensure this URL is correct for your environment (e.g., use environment variables)
        const serviceApiUrl = process.env.SERVICE_API_URL || 'http://localhost:3000/service-lst';
        const serviceResponse = await axios.get(serviceApiUrl);
        if (serviceResponse.data && Array.isArray(serviceResponse.data)) {
             servicesList = serviceResponse.data; // Expecting an array like [{ key: 'service1', name: 'Service One' }, ...]
        } else {
            console.error('Invalid format received from /service-lst endpoint:', serviceResponse.data);
        }
    } catch (apiError) {
        console.error("Error fetching service list from API:", apiError.message);
        // Decide if this is critical. Maybe render the page without services?
        // For now, we proceed with an empty list, but you might want to show an error.
    }


    // 4. Render Profile Page
    res.render('profile', { // Ensure 'profile' matches your EJS template file name
      user: { // Pass only necessary, serializable data
        _id: user._id.toString(), // Convert ObjectId to string
        email: user.email,
        shopName: user.shopName,
        personName: user.personName,
        centerId: user.centerId,
        phone: user.phone,
        district: user.district,
        subdistrict: user.subdistrict,
        type: user.type,
        // Ensure services is an object (even if empty) for safe access in EJS
        // Convert Map to Object if necessary, handle null/undefined
        services: user.services instanceof Map ? Object.fromEntries(user.services) : (user.services || {}),
        // Convert Mongoose subdocument to plain object
        address: user.address ? user.address.toObject() : {} // Handle case where address might be missing
      },
      services: servicesList // Pass the fetched master list of services
    });

  } catch (error) {
    console.error("Error fetching profile:", error);
    // Render a generic error page
    res.status(500).render('error', { message: 'Server error while loading your profile.' });
  }
});


// --- PUT Route to Update User Profile --- MODIFIED
router.post('/profile-update', async (req, res) => {
  // 1. Check Authentication
  if (!req.session.user || !req.session.user.id) {
    return res.status(401).json({ message: "Unauthorized. Please log in again." });
  }

  try {
    const userId = req.session.user.id;
    const {
      // Email should not be updated here for security/simplicity
      shopName,
      personName,
      phone,
      type,
      district,
      subdistrict,
      address, // Expecting { buildingName, street, locality, pincode }
      services // Expecting { serviceKey1: true, serviceKey2: false, ... }
    } = req.body;

    // Log incoming services data
    console.log('Received services in request body:', services);

    // 2. Basic Input Validation (Add more specific validation as needed)
    if (!shopName || !personName || !phone || !type || !district || !address || !address.pincode) {
        return res.status(400).json({ message: "Missing required profile information (Shop Name, Person Name, Phone, Type, District, Pincode are required)." });
    }
    // Validate pincode format
     if (address.pincode && !/^\d{6}$/.test(address.pincode)) {
         return res.status(400).json({ message: "Invalid Pincode format. Must be 6 digits." });
     }
     // Validate phone format (basic example)
     if (phone && !/^\d{10,15}$/.test(phone)) { // Example: 10-15 digits
         return res.status(400).json({ message: "Invalid Phone Number format." });
     }
     // Validate type
     if (!['CSC', 'Akshaya'].includes(type)) {
         return res.status(400).json({ message: "Invalid Centre Type selected." });
     }


    // 3. Find User
    const user = await User.findById(userId);
    const centre = await Centre.findOne({centerId: user.centerId});
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // 4. Update User Fields (excluding email)
    user.shopName = shopName;
    centre.centreName = shopName;
    user.personName = personName;
    centre.ownerName = personName;
    user.phone = phone;
    centre.contact = phone;
    user.type = type;
    centre.type = type;
    user.district = district;
    centre.district = district;
    user.subdistrict = subdistrict; // Store empty string if null/undefined/empty
    centre.subdistrict = subdistrict;

    // Update nested address fields safely
    if (!user.address) {
      user.address = {}; // Initialize if it doesn't exist
    }
    user.address.buildingName = address.buildingName || '';
    user.address.street = address.street || '';
    user.address.locality = address.locality || '';
    user.address.pincode = address.pincode;

    if (!centre.address) {
      centre.address = {}; // Initialize if it doesn't exist
    }
    centre.address.buildingName = address.buildingName || '';
    centre.address.street = address.street || '';
    centre.address.locality = address.locality || '';
    centre.address.pincode = address.pincode;

    // 5. --- Dynamic Service Update ---
    // Directly replace the user's services field with the object received from the frontend.
    user.services = services; // Assign the incoming object
    centre.services = services;

    // **IMPORTANT**: Explicitly tell Mongoose the 'services' path was modified.
    // This is usually necessary if your User schema defines 'services' as Mixed.
    // If 'services' is defined as a Map, this might not be needed, but often doesn't hurt.
    // user.markModified('services'); // *** THIS LINE IS NOW UNCOMMENTED ***
    // --- End Dynamic Service Update ---

    // 6. Save Updated User
    await user.save();
    await centre.save();

    // 7. Respond with Success
    res.status(200).json({ message: "Profile updated successfully" });

  } catch (error) {
    console.error("Error updating profile:", error);
    // Check for specific validation errors from Mongoose if any
    if (error.name === 'ValidationError') {
        return res.status(400).json({ message: "Validation Error: " + error.message });
    }
    // Provide a generic server error message to the client
    res.status(500).json({ message: "Server error occurred while updating profile." });
  }
});

module.exports = router;