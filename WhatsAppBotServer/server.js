// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const createChatbotRoutes = require('./routes/chatbotRoutes');

const app = express();

// Parse both URL‑encoded (Twilio) and JSON bodies
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Connect to MongoDB
connectDB();

// Load your API bases from .env (or fallback)
const CHAT_API_BASE      = process.env.CHAT_API_BASE      || 'https://f5ae-34-83-103-241.ngrok-free.app';
const TRANSLATE_API_BASE = process.env.TRANSLATE_API_BASE || 'https://62b0-34-55-220-72.ngrok-free.app';

// Instantiate your controller with those URLs
const chatbotController = require('./controllers/chatbotController')({
  CHAT_API_BASE,
  TRANSLATE_API_BASE
});

// Mount routes, passing in the controller
app.use('/', createChatbotRoutes(chatbotController));

// Optional health check
app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 5600;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
