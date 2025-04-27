// chatScreenServer.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import CORS
const path = require('path'); // To serve static files
const connectDB = require('./config/db'); // Reuse DB connection
const createChatScreenRoutes = require('./chatScreenRoutes'); // New routes

// --- Configuration ---
const PORT = process.env.CHAT_SCREEN_PORT || 3030; // Use a different port
const HOST = process.env.HOST || 'localhost';
const CHAT_API_BASE = process.env.CHAT_API_BASE;
// Keep DOCUMENT_SERVICE_API_BASE if needed by modules used indirectly
const DOCUMENT_SERVICE_API_BASE = process.env.DOCUMENT_SERVICE_API_BASE;
const AXIOS_TIMEOUT = parseInt(process.env.AXIOS_TIMEOUT, 10) || 15000; // Reuse timeout

if (!CHAT_API_BASE) {
  console.error("FATAL: CHAT_API_BASE environment variable not set.");
  // process.exit(1); // Optional: exit if critical config is missing
}

const app = express();

// --- Middleware ---
// You might need to configure CORS more restrictively for production
app.use(cors()); // Enable CORS for all origins
app.use(bodyParser.json()); // Parse JSON bodies
app.use(bodyParser.urlencoded({ extended: true })); // Parse URL-encoded bodies

// --- Static Files ---
// Serve the chat.html and chat.js from a 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Database ---
connectDB(); // Connect to MongoDB

// --- Logger (Simple) ---
// You can replace this with a more robust logger if needed
const logger = {
  info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args),
};

// --- Routes ---
// Pass necessary config and logger to the routes
app.use('/api/chat', createChatScreenRoutes({ logger, CHAT_API_BASE, AXIOS_TIMEOUT }));

// --- Basic Routes ---
// Route to serve the chat interface HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Health check endpoint
app.get('/health', (req, res) => res.send('OK'));
// --- Start Server ---
// Explicitly provide 'localhost' or '127.0.0.1' as the hostname
app.listen(PORT, 'localhost', () => {
    console.log('\\n==================================');
    console.log('CHAT SCREEN SERVER');
    console.log('==================================');
    // Update the log message to reflect the explicit host
    console.log(`Server URL: http://localhost:${PORT}`);
    console.log(`Chat API Base: ${CHAT_API_BASE || 'Not Set'}`);
    console.log('==================================\\n');
  });