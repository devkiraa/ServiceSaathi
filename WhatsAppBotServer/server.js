// server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');
const chalk = require('chalk'); // Import chalk
const createChatbotRoutes = require('./routes/chatbotRoutes');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

connectDB();

const CHAT_API_BASE = process.env.CHAT_API_BASE;
const DOCUMENT_SERVICE_API_BASE = process.env.DOCUMENT_SERVICE_API_BASE;

const chatbotController = require('./controllers/chatbotController')({
  CHAT_API_BASE, DOCUMENT_SERVICE_API_BASE
});

app.use('/', createChatbotRoutes(chatbotController));

app.get('/health', (req, res) => res.send('OK'));

const PORT = process.env.PORT || 5600;
app.listen(PORT, () => {
  const HOST = process.env.HOST || 'localhost';
  const protocol = process.env.HTTPS === 'true' ? 'https' : 'http';

  console.log(chalk.bold('\n=================================='));
  console.log(chalk.bold.blue('🚀 SERVICE SAATHI WHATSAPP SERVER'));
  console.log(chalk.bold('=================================='));
  console.log(`${chalk.cyan('🔗 Server URL:')} ${chalk.underline.blue(`${protocol}://${HOST}:${PORT}`)}`); // Use actual host/port
  console.log(`${chalk.magenta('📦 Running on port:')} ${chalk.yellow(PORT)}`);
  console.log(`${chalk.green('📅 Start time:')} ${new Date().toLocaleString()}`);
  console.log(`${chalk.yellow('🌐 Environment:')} ${process.env.NODE_ENV || 'development'}`);
  console.log(`${chalk.blue('💬 Chat API Base:')} ${CHAT_API_BASE ? chalk.underline.blue(CHAT_API_BASE) : chalk.gray('Not Set')}`);
  console.log(`${chalk.blue('📄 Document Service Web:')} ${DOCUMENT_SERVICE_API_BASE ? chalk.underline.blue(DOCUMENT_SERVICE_API_BASE) : chalk.gray('Not Set')}`);
  console.log(chalk.bold('===================================\n'));
});