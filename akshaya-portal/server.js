// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const session = require('express-session');
const path = require('path');
const moment = require('moment');
const chalk = require('chalk'); // Import chalk

dotenv.config();
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Built-in middleware for JSON request body parsing
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

// let upload; // Removed

// MongoDB Atlas Connection
mongoose.connect(process.env.MONGO_URI, { dbName: 'akshyaportal' }).then(() => {
  console.log("✅ MongoDB Atlas connected to CHATBOTDB");
  console.log('\n=======================================');
  console.log(`${chalk.magenta('\nLogs from Service Saathi WhatsApp Server')}`);

  const authRoutes = require('./routes/auth');
  const documentRoutes = require('./routes/documents');
  const adminRoutes = require('./routes/admin');
  const serviceRoutes = require('./routes/service');
  const serviceAdminRoutes = require('./routes/serviceAdmin');
  const weatherRoutes = require('./routes/weather');
  const dashboardRoutes = require('./routes/dashboard');
  const userRoutes = require('./routes/user');

  app.use(authRoutes);
  app.use('/',documentRoutes);
  app.use(adminRoutes);
  app.use('/', serviceRoutes); // Mount service routes at the root
  app.use('/', serviceAdminRoutes); // Mount service admin routes at the root
  app.use('/api', weatherRoutes);
  app.use('/api', dashboardRoutes);
  app.use('/', userRoutes);

  // Helper function to format date
  function formatDate(dateString) {
    if (!dateString) return 'N/A'; // Handle missing or invalid dates
    return moment(dateString).format('hh:mm A DD/MM/YYYY');
  }
  
  // Make formatDate available to all EJS templates
  app.locals.formatDate = formatDate;

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

  app.get('/dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    if (req.session.user.role === 'admin') return res.redirect('/admin-dashboard');
    try {
      // Fetch recent documents
      const documents = await Document.find().sort({ createdAt: -1 }).limit(10);
  
      // Fetch user details
      const user = await User.findOne({ _id: req.session.user.id });
      if (!user) return res.status(404).send("User not found");
  
      // Fetch service requests for the user's center
      const serviceRequests = await ServiceRequest.find({ centreId: user.centerId });
  
      // Calculate total pending services
      const pendingServices = await ServiceRequest.countDocuments({
        centreId: user.centerId, // Use user.centerId instead of serviceRequests.centerId
       status: { $in: ["submitted", "started", "pending", "approved", "rejected", "reupload_required"] },
      });
  
      // Calculate total completed services
      const completedServices = await ServiceRequest.countDocuments({
        centreId: user.centerId, // Use user.centerId instead of serviceRequests.centerId
        status: 'completed',
      });
  
      // Calculate service type distribution
      const serviceTypes = {};
      serviceRequests.forEach((sr) => {
        const serviceType = sr.documentType;
        if (serviceTypes[serviceType]) {
          serviceTypes[serviceType]++;
        } else {
          serviceTypes[serviceType] = 1;
        }
      });
  
      // Convert to array format for chart rendering
      const serviceData = Object.entries(serviceTypes).map(([type, count]) => ({
        label: type,
        value: count,
      }));
  
      // Calculate total services
      const totalServices = serviceRequests.length;
  
      // Calculate percentages
      const servicePercentages = serviceData.map(({ label, value }) => ({
        label,
        value: (value / totalServices) * 100, // Percentage
      }));
  
      // Render the dashboard with the calculated data
      res.render('dashboard', {
        user: req.session.user,
        documents, // Pass fetched documents
        serviceRequests: serviceRequests.map((sr) => ({
          documentType: sr.documentType,
          mobileNumber: sr.mobileNumber,
          status: sr.status,
          action: sr.action,
        })),
        pendingServices, // Total pending services
        completedServices, // Total completed services
        servicePercentages, // Pass the calculated percentages
        totalServices, // Total services
      });
    } catch (error) {
      console.error("Error fetching user or service requests:", error);
      res.status(500).send("Server error: " + error.message);
    }
  });
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1); // Stop server if DB fails
});

// Start Server
const PORT = process.env.PORT || 5601;
app.listen(PORT, () => {
  const HOST = process.env.HOST || 'localhost';
  const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';
  console.log(chalk.bold('\n================================'));
  console.log(chalk.bold.blue('🚀 SERVICE SAATHI WEBSITE SERVER')); // Changed color
  console.log(chalk.bold('================================'));
  console.log(`${chalk.cyan('🔗 Server URL:')} ${chalk.underline.blue(`${protocol}://${HOST}:${PORT}`)}`);
  console.log(`${chalk.magenta('📦 Running on port:')} ${chalk.yellow(PORT)}`);
  console.log(`${chalk.green('📅 Start time:')} ${new Date().toLocaleString()}`);
  console.log(`${chalk.yellow('🌐 Environment:')} ${process.env.NODE_ENV || 'development'}`);
  console.log(chalk.bold('================================\n'));
});