const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const session = require('express-session');
const path = require('path');

dotenv.config();
const app = express();

// MongoDB Atlas Connection
mongoose.connect(process.env.MONGO_URI, { dbName: 'akshyaportal' })
  .then(() => console.log('✅ MongoDB Atlas connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // Stop server if DB fails
  });

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  
}));

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/sendimage', express.static(path.join(__dirname, 'uploads/service-documents')));

// Models
const User = require('./models/User');
const Document = require('./models/Document');
const ServiceRequest = require('./models/ServiceRequest');

// Routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const serviceRoutes = require('./routes/service');
const { json } = require('stream/consumers');

app.use(authRoutes);
app.use(documentRoutes);
app.use(adminRoutes);
app.use(serviceRoutes);

// Login Page
app.get('/', (req, res) => {
  res.render('login');
});
// Logout Page
app.get('/logout', (req, res) => {
  res.render('logout');

}); 
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
      if (err) {
          return res.status(500).json({ success: false, message: "Logout failed" });
      }
      return res.redirect('/login');
     // return res.json({ success: true, message: "Logged out successfully" });
      
  });
}); 

// Admin: Add User Page
app.get('/add-user', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  res.render('addUser');
});

// Signup Page
app.get('/signup', (req, res) => {
  res.render('signup');
});
// Signup Page
app.get('/change-password', (req, res) => {
  res.render('changePassword');
});

// Dashboard Route
app.get('/dashboard', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  if (req.session.user.role === 'admin') return res.redirect('/admin-dashboard');

  try {
    const documents = await Document.find().sort({ createdAt: -1 }).limit(10);
    const serviceRequests = await ServiceRequest.find({ centreId: req.session.user.centerId });

    res.render('dashboard', { user: req.session.user, documents, serviceRequests });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get('/profile', async (req, res) => {
  if (!req.session.user) return res.redirect('/');

  try {
    const user = await User.findOne({ _id: req.session.user.id });
    if (!user) return res.status(404).send("User not found");

    res.render('profile', { 
      user: {
        email: user.email,
        shopName: user.shopName ,
        personName: user.personName,
        centerId: user.centerId,
        phone:user.phone,
        district:user.district,
        centreType:user.centreType,
        services:user.services.toObject(),
        address:user.address.toObject() 
      }
    });
  } catch (error) {
    res.status(500).send("Server error: " + error.message);
  }
}); 
app.use(express.json()); // Built-in middleware for JSON request body parsing
app.post('/profile', async (req, res) => {
  try {
      const { email, shopName, personName, centerId, phone, centreType, district, address, services } = req.body;

      if (!email || !shopName || !personName || !centerId || !phone || !centreType || !district || !address || !services) {
          return res.status(400).json({ message: 'All fields are required!' });
      }

      let user = await User.findOne({ email });

      if (user) {
          // Update existing profile
          user.shopName = shopName;
          user.personName = personName;
          user.centerId = centerId;
          user.phone = phone;
          user.centreType = centreType;
          user.district = district;
          user.address = address;
          user.services = services;

          await user.save();
          req.session.user = user; // Update session data
          return res.status(200).json({ message: 'Profile updated successfully!', data: user });
      } else {
          // Create new profile
          const newUser = new User({ email, shopName, personName, centerId, phone, centreType, district, address, services });
          await newUser.save();
          req.session.user = newUser; // Store in session
          return res.status(201).json({ message: 'Profile created successfully!', data: newUser });
      }
  } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
  }
});

/* app.put('/profile/update-profile', async (req, res) => {
  try {
      const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!user) return res.status(404).json({ message: 'User not found' });

      // Update session data
      req.session.user = user;
      await req.session.save();

      res.json({ message: 'Profile updated successfully', user });
  } catch (error) {
      res.status(500).json({ message: 'Server Error', error });
  }
});
*/
/* app.post('/profile', (req, res) => {
  const { email, shopName, personName, centerId, phoneNumber, district,address,services } = req.body;

  if (!userProfile.email) {
      return res.status(404).json({ message: 'Profile not found' });
  }

  // Update only the provided fields
  userProfile = {
      ...userProfile,
      email: email || user.email,
      shopName: shopName || user.shopName,
      personName: personName || user.personName,
      centerId: centerId || user.centerId,
      phoneNumber: phoneNumber || user.phoneNumber,
      district: district || user.district,
      address:address || user.address,
      services:services || user.services
  };

  res.json({ message: 'Profile updated successfully', data: userProfile });
});
*/

// Continue Application Route (Fixed)
app.get('/continue-application/:serviceRequestId', async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).send("Service request not found.");
    }

    // Populate customer details from session if available
    const customer = req.session.user || {};

    res.render('continueApplication', {
      customerName: customer.name || "",
      mobile: customer.mobile || "",
      email: customer.email || "",
      address: customer.address || "",
      dob: customer.dob || "",
      serviceRequest: serviceRequest
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
