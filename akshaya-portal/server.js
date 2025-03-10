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
        type:user.type

      }
    });
  } catch (error) {
    res.status(500).send("Server error: " + error.message);
  }
});

app.post('/profile/update-email', async (req, res) => {
  if (!req.session.user || !req.session.user.id) 
    return res.status(401).json({ error: "Unauthorized access" });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const user = await User.findById(req.session.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.email = email;
    await user.save();

    // Update session data so the new email reflects in the profile page
    req.session.user.email = email;

    res.json({ success: true, message: "Email updated successfully!" });
  } catch (error) {
    res.status(500).json({ error: "Database error: " + error.message });
  }
});

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
