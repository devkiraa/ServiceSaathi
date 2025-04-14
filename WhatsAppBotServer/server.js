// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const createChatbotRoutes = require('./routes/chatbotRoutes');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

connectDB();

const CHAT_API_BASE = process.env.CHAT_API_BASE;
const DOCUMENT_SERVICE_API_BASE = process.env.DOCUMENT_SERVICE_API_BASE;

const chatbotController = require('./controllers/chatbotController')({
  CHAT_API_BASE,DOCUMENT_SERVICE_API_BASE
});

app.use('/', createChatbotRoutes(chatbotController));

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 5600;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
