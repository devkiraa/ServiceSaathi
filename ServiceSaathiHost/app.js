const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const routes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session Configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 3600000 } // 1 hour
}));

// Passport Configuration
app.use(passport.initialize());
app.use(passport.session());

// View Engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Routes
app.use('/login', authRoutes);
app.use('/signup', authRoutes);
app.use('/', routes);

// Make req available in templates
app.use((req, res, next) => {
    res.locals.req = req;
    next();
});

// Server Port
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});