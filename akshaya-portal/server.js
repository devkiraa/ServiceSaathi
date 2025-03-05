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

// Routes
const authRoutes = require('./routes/auth');
const documentRoutes = require('./routes/documents');
const adminRoutes = require('./routes/admin');

app.use(authRoutes);
app.use(documentRoutes);
app.use(adminRoutes);

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

// Dashboard route (for regular users)
// Fetch recent documents (services) from the database
const Document = require('./models/Document');
app.get('/dashboard', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  try {
    const documents = await Document.find().sort({ createdAt: -1 }).limit(10);
    res.render('dashboard', { user: req.session.user, documents });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
