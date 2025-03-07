const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const session = require('express-session');
const path = require('path');
dotenv.config();

const app = express();

// MongoDB Atlas connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true, // deprecated notice only
  useUnifiedTopology: true, // deprecated notice only
  dbName: 'akshyaportal'
})
.then(() => console.log('MongoDB Atlas connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Set view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/sendimage', express.static(path.join(__dirname, 'uploads/service-documents')));

// Routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');
const serviceRoutes = require('./routes/service'); // New service routes

app.use(authRoutes);
app.use(documentRoutes);
app.use(adminRoutes);
app.use(serviceRoutes);

// Login page
app.get('/', (req, res) => {
  res.render('login');
});

// Add user page (for admin to create new users with role selection)
app.get('/add-user', (req, res) => {
  // Optionally protect this route so only admins can access it
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  res.render('addUser');
});

// Signup page
app.get('/signup', (req, res) => {
  res.render('signup');
});

const Document = require('./models/Document');
const ServiceRequest = require('./models/ServiceRequest');

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

app.get('/continue-application/:serviceRequestId', async (req, res) => {
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) {
      return res.status(404).send("Service request not found.");
    }
    // For now, customer details are blank.
    res.render('continueApplication', {
      customerName: "",  // to be filled later
      mobile: "",        // to be filled later
      email: "",         // to be filled later
      address: "",       // to be filled later
      dob: "",           // to be filled later
      serviceRequest: serviceRequest
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
