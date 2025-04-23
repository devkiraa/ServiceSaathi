// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const session = require('express-session');
const path = require('path');
// const GridFsStorage = require('multer-gridfs-storage'); // Removed
// const multer = require('multer'); // Removed
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
  console.log('\nLogs from Service Saathi WhatsApp Server');
  // --- Configure GridFS Storage AFTER successful database connection ---
  // const storage = new GridFsStorage({ ... }); // Removed
  // Initialize multer upload middleware after storage is configured
  // upload = multer({ storage }); // Removed
  // Export the upload middleware
  // module.exports.upload = upload; // Removed
  // Routes - Require routes AFTER database connection is established

  const authRoutes = require('./routes/auth');
  const documentRoutes = require('./routes/documents');
  const adminRoutes = require('./routes/admin');
  const serviceRoutes = require('./routes/service');
  const serviceAdminRoutes = require('./routes/serviceAdmin');
  const weatherRoutes = require('./routes/weather');

  app.use(authRoutes);
  app.use(documentRoutes);
  app.use(adminRoutes);
  app.use('/', serviceRoutes); // Mount service routes at the root
  app.use('/', serviceAdminRoutes); // Mount service admin routes at the root
  app.use('/api', weatherRoutes);

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
  // app.get('/dashboard', async (req, res) => {
  //   if (!req.session.user) return res.redirect('/');
  //   if (req.session.user.role === 'admin') return res.redirect('/admin-dashboard');
  //   try {
  //     const documents = await Document.find().sort({ createdAt: -1 }).limit(10);
  //     const serviceRequests = await ServiceRequest.find({ centreId: req.session.user.centerId });
  //     res.render('dashboard', { user: req.session.user, documents, serviceRequests });
  //   } catch (error) {
  //     res.status(500).send(error.message);
  //   }
  // });

  app.get('/dashboard', async (req, res) => {
    if (!req.session.user) return res.redirect('/');
    if (req.session.user.role === 'admin') return res.redirect('/admin-dashboard');
    try {
      // Fetch recent documents
      const documents = await Document.find().sort({ createdAt: -1 }).limit(10);
      console.log("Fetched Documents:", documents); // Debugging log
  
      // Fetch user details
      const user = await User.findOne({ _id: req.session.user.id });
      if (!user) return res.status(404).send("User not found");
  
      // Fetch service requests for the user's center
      const serviceRequests = await ServiceRequest.find({ centreId: user.centerId });
  
      // Calculate total pending services
      const pendingServices = await ServiceRequest.countDocuments({
        centreId: user.centerId, // Use user.centerId instead of serviceRequests.centerId
       status: { $in: ['started', 'submitted'] },
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
      
 app.get('/api/service-data', async (req, res) => {
    const { period } = req.query; // Extracts the 'period' query parameter
    const user = req.session.user; // Get the logged-in user from the session

  if (!user || !user.centerId) {
    return res.status(400).send("User or centerId not found in session");
  }
    try {
      let serviceData;
  
      if (period === 'today') {
        serviceData = await ServiceRequest.aggregate([
          { $match: { createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } ,
          centreId: user.centerId } },
          { $group: { _id: '$documentType', count: { $sum: 1 } } },
        ]);
      } else if (period === 'week') {
        serviceData = await ServiceRequest.aggregate([
          { $match: { createdAt: { $gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) } ,
          centreId: user.centerId } },
          { $group: { _id: '$documentType', count: { $sum: 1 } } },
        ]);
      } else if (period === 'month') {
        serviceData = await ServiceRequest.aggregate([
          { $match: { createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) },
          centreId: user.centerId  } },
          { $group: { _id: '$documentType', count: { $sum: 1 } } },
        ]);
      } else {
        serviceData = await ServiceRequest.aggregate([
          { $group: { _id: '$documentType', count: { $sum: 1 } } },
        ]);
      }
  
      const total = serviceData.reduce((sum, item) => sum + item.count, 0);
      const formattedData = serviceData.map(item => ({
        label: item._id,
        value: ((item.count / total) * 100).toFixed(2),
      }));
  
      res.json(formattedData);
    } catch (error) {
      console.error("Error fetching service data:", error);
      res.status(500).send("Server error");
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
  app.get('/api/line-data', async (req, res) => {
    const { period } = req.query; // Extract the 'period' query parameter
    const user = req.session.user; // Get the logged-in user from the session

  if (!user || !user.centerId) {
    return res.status(400).send("User or centerId not found in session");
  }
    try {
      let lineChartData;
  
      if (period === 'week') {
        // Line chart data for the last week (daily aggregation)
        lineChartData = await ServiceRequest.aggregate([
          { 
            $match: { createdAt: { $gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) } ,
            centreId: user.centerId},
            
          },
          { 
            $group: { 
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }, }, 
              count: { $sum: 1 } 
            } 
          },
          { 
            $sort: { _id: 1 } 
          },
        ]);
      } else if (period === 'month') {
        // Line chart data for the current month (weekly aggregation)
        lineChartData = await ServiceRequest.aggregate([
          { 
            $match: { createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) } ,
            centreId: user.centerId },
           
          },
          { 
            $group: { 
              _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, 
              count: { $sum: 1 } 
            } 
          },
          { 
            $sort: { _id: 1 } 
          },
        ]);
      } else if (period === 'year') {
        // Line chart data for the last year (monthly aggregation)
        lineChartData = await ServiceRequest.aggregate([
          {
          $match: {
            
             createdAt: { $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1)) } ,
            centreId: user.centerId, // Filter by the logged-in user's centerId
          }
        },
          { 
            $group: { 
              _id: { $dateToString: { format: '%Y', date: '$createdAt' } }, 
              count: { $sum: 1 } 
            }
          },
          { 
            $sort: { _id: 1 } 
          },
        ]);
        }

       else if(period ==='all'){// Default: All data
        lineChartData = await ServiceRequest.aggregate([
          { 
            $match: {
              createdAt: { $gte: new Date(0) }, // Matches all dates (from the epoch time)
              centreId: user.centerId, // Filter by the logged-in user's centerId
            }
          },
          {
            $group: { 
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }},
              count: { $sum: 1 } 
      
            } 
          
          },
      
          { 
            $sort: { _id: 1 } 
          },
        ]);
      }
  
      // Handle empty data gracefully
      if (lineChartData.length === 0) {
        return res.json({
          lineChart: [],
          totalServices: 0,
          pendingServices: 0,
          completedServices: 0,
        });
      }
  // Calculate total services


  // Format the data
  const formattedData = lineChartData.map(item => ({
    label: item._id, // Time period (e.g., date, week, month, year)
    value: item.count, // Total number of services for this period
  }));

  // Send Response
  res.json(formattedData);
  
      
    } catch (error) {
      console.error("Error fetching service data:", error);
      res.status(500).send("Server error");
    }
  });

  app.post('/profile', async (req, res) => {
    try {
      const { email, shopName, personName, phone, type, district, address, services } = req.body;
      console.log("📌 Received Form Data:", req.body); // ✅ Log received data
      if (!email || !shopName || !personName || !phone || !type || !district || !address || !services) {
        return res.status(400).json({ message: 'All fields are required!' });
      }
      let user = await User.findOne({ email });
      if (user) {
        // Update existing profile
        user.shopName = shopName;
        user.personName = personName;
        user.phone = phone;
        user.type = type;
        user.district = district;
        user.address = { ...user.address, ...address }; // Merging old & new address
        user.services = { ...user.services, ...services }; // Merging services
        await user.save();
        req.session.user = user; // Update session data
        return res.status(200).json({ message: 'Profile updated successfully!', data: user });
      } else {
        // Create new profile
        const newUser = new User({ email, shopName, personName, centerId, phone, type, district, address, services });
        await newUser.save();
        req.session.user = newUser; // Store in session
        return res.status(201).json({ message: 'Profile created successfully!', data: newUser });
      }
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ message: 'Internal Server Error' });
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
  console.log('\n================================');
  console.log('🚀 SERVICE SAATHI WEBSITE SERVER');
  console.log('================================');
  console.log(`🔗 Server URL: ${protocol}://${HOST}:${PORT}`);
  console.log(`📦 Running on port: ${PORT}`);
  console.log('📅 Start time:', new Date().toLocaleString());
  console.log('🌐 Environment:', process.env.NODE_ENV || 'development');
  console.log('================================\n');
});