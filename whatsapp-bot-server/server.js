// server.js
// Force public DNS to resolve MongoDB Atlas SRV records
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const chalk = require('chalk');
const path = require('path');
const cors = require('cors');
const createChatbotRoutes = require('./routes/chatbotRoutes');
const createChatScreenRoutes = require('./chatScreenRoutes');

const app = express();
app.use(cors()); // Enable CORS
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Serve static files (Chat Screen UI)
app.use(express.static(path.join(__dirname, 'public')));

connectDB();

const CHAT_API_BASE = process.env.CHAT_API_BASE;
const DOCUMENT_SERVICE_API_BASE = process.env.DOCUMENT_SERVICE_API_BASE;
const AXIOS_TIMEOUT = 15000;

// Simple Logger (from chatScreenServer.js)
const logger = {
  info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args),
};

// 1. WhatsApp Bot Controller & Routes
const chatbotController = require('./controllers/chatbotController')({
  CHAT_API_BASE, DOCUMENT_SERVICE_API_BASE
});
app.use('/', createChatbotRoutes(chatbotController));

// 2. Chat Screen Routes (for Web UI)
app.use('/api/chat', createChatScreenRoutes({ logger, CHAT_API_BASE, AXIOS_TIMEOUT, DOCUMENT_SERVICE_API_BASE }));

// 3. Serve Chat Interface (Root)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 5600;
app.listen(PORT, () => {
  const HOST = process.env.HOST || 'localhost';
  const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';

  console.log(chalk.bold('\n=================================='));
  console.log(chalk.bold.blue('🚀 SERVICE SAATHI WHATSAPP SERVER'));
  console.log(chalk.bold('=================================='));
  console.log(`${chalk.cyan('🔗 Server URL:')} ${chalk.underline.blue(`${protocol}://${HOST}:${PORT}`)}`);
  console.log(`${chalk.magenta('📦 Running on port:')} ${chalk.yellow(PORT)}`);
  console.log(`${chalk.green('📅 Start time:')} ${new Date().toLocaleString()}`);
  console.log(`${chalk.yellow('🌐 Environment:')} ${process.env.NODE_ENV || 'development'}`);
  console.log(`${chalk.blue('💬 Chat API Base:')} ${CHAT_API_BASE ? chalk.underline.blue(CHAT_API_BASE) : chalk.gray('Not Set')}`);
  console.log(chalk.bold('===================================\n'));
});