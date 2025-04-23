// controllers/chatbotController.js
const Chat = require('../models/chat');
const User = require('../models/wha-user');
const client = require('../config/twilio');
// Consider using a structured logger like Winston or Pino
const logger = { // Simple logger wrapper (replace with Winston/Pino if needed)
  info: (message, ...args) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args),
  error: (message, ...args) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args),
  // Add a debug level if you want more verbosity during development
  // debug: (message, ...args) => { if (process.env.NODE_ENV === 'development') console.log(`[DEBUG] ${new Date().toISOString()}: ${message}`, ...args); }
};

// Configuration - Ensure these are loaded securely (e.g., from process.env)
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;
const AXIOS_TIMEOUT = 15000; // 15 seconds timeout for external API calls

module.exports = function({ CHAT_API_BASE, DOCUMENT_SERVICE_API_BASE }) {
  if (!TWILIO_WHATSAPP_NUMBER) {
    logger.error("FATAL: TWILIO_WHATSAPP_NUMBER environment variable not set.");
    process.exit(1); // Exit if essential config is missing
  }

  // ─── HELPERS ────────────────────────────────────────────────────────────────
  const storeChatMessage = async (userPhone, message, direction) => {
    try {
      const sanitizedMessage = message.replace(/<[^>]*>?/gm, '');
      await Chat.create({ userPhone, message: sanitizedMessage, direction });
    } catch (err) {
      logger.error(`Error storing chat for ${userPhone}:`, err);
    }
  };

  const sendMessage = async (to, body) => {
    try {
      const recipient = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
      const sanitizedBody = body.replace(/<[^>]*>?/gm, '');

      await client.messages.create({
        from: `whatsapp:${TWILIO_WHATSAPP_NUMBER}`,
        to: recipient,
        body: sanitizedBody
      });
      // Avoid logging every outbound message content unless debugging
      // logger.info(`Sent message to ${recipient}: "${sanitizedBody.substring(0, 50)}..."`);
      await storeChatMessage(recipient.replace("whatsapp:", ""), sanitizedBody, 'outbound');
    } catch (err) {
      logger.error(`Error sending message to ${to}:`, err);
    }
  };

  // ─── LOAD MODULES ───────────────────────────────────────────────────────────
  const languageModule = require('./modules/languageModule')(sendMessage, logger);
  const applyModule = require('./modules/applyModule')(sendMessage, DOCUMENT_SERVICE_API_BASE, logger, AXIOS_TIMEOUT);
  const optionModule = require('./modules/optionModule')(sendMessage, applyModule, CHAT_API_BASE, logger, AXIOS_TIMEOUT);
  const chatModule = require('./modules/chatModule')(sendMessage, CHAT_API_BASE, logger, AXIOS_TIMEOUT);
  const statusModule = require('./modules/statusModule')(sendMessage, DOCUMENT_SERVICE_API_BASE, logger, AXIOS_TIMEOUT);

  // ─── HANDLER: Inbound user messages ─────────────────────────────────────────
  const handleMessage = async (req, res) => {
    if (!req.body || typeof req.body.Body !== 'string' || typeof req.body.From !== 'string') {
       logger.warn('Received invalid request body structure');
       return res.status(400).send('Invalid request');
    }

    const Body = req.body.Body.trim();
    const From = req.body.From.trim();
    const userPhone = From.replace(/^whatsapp:/i, "");

    if (!Body || Body.length === 0 || Body.toLowerCase() === "ok") {
      return res.status(204).end();
    }

    // Log incoming message marker, but maybe not full content by default
    // logger.info(`Received message from ${userPhone}: "${Body.substring(0, 50)}..."`);
    const sanitizedBody = Body.replace(/<script.*?>.*?<\/script>/gi, '');
    await storeChatMessage(userPhone, sanitizedBody, 'inbound');

    let user;
    try {
      user = await User.findOne({ phoneNumber: userPhone });
      if (!user) {
        // Reduced logging verbosity here
        // logger.info(`Creating new user for ${userPhone}`);
        user = new User({ phoneNumber: userPhone, lastOption: null, language: null, applyDataTemp: {}, applications: [] });
        user.applyDataTemp = user.applyDataTemp || {};
        user.applications = user.applications || [];
        await user.save();
      } else {
         user.applyDataTemp = user.applyDataTemp || {};
         user.applications = user.applications || [];
      }
    } catch (dbError) {
      logger.error(`Database error fetching/creating user ${userPhone}:`, dbError);
      await sendMessage(From, "We encountered a problem accessing your profile. Please try again later.");
      return res.sendStatus(500);
    }

    const lower = sanitizedBody.toLowerCase();
    logger.info(`Processing command/input "${lower}" for ${userPhone} (State: lang=${user.language}, option=${user.lastOption}, apply=${user.applyState})`);


    // --- Global Commands Handling ---
    if (lower === "/lang") {
      logger.info(`Resetting language for ${userPhone}`);
      user.language = null;
      user.lastOption = null;
      user.applyState = null;
      user.applyDataTemp = {};
      await user.save();
      await languageModule.prompt(From);
      return res.sendStatus(200);
    }

    if (lower === "/service") {
      logger.info(`Handling /service command for ${userPhone}`);
      await statusModule.checkAll(user, From);
      return res.sendStatus(200);
    }

    // --- Standard Flow ---
    if (lower === "hi" || lower === "hello" || lower === "menu") {
      logger.info(`Handling greeting/menu request for ${userPhone}`);
      user.lastOption = null;
      user.applyState = null;
      user.applyDataTemp = {};
      await user.save();
      if (!user.language) {
        await languageModule.prompt(From);
      } else {
        await optionModule.prompt(user, From);
      }
      return res.sendStatus(200);
    }

    // STEP 1: language selection
    if (!user.language) {
      logger.info(`Handling language selection for ${userPhone}`);
      await languageModule.choose(sanitizedBody, user, From);
      return res.sendStatus(200);
    }

    // STEP 2: Main option selection (if not in a specific flow like 'apply')
    if (!user.lastOption && !user.applyState) {
       logger.info(`Handling main option selection for ${userPhone}`);
       await optionModule.choose(sanitizedBody, user, From);
       return res.sendStatus(200);
    }

    // STEP 3: Delegate to active module
    if (user.applyState || user.lastOption === "apply") {
        if (user.lastOption !== "apply") { // Ensure lastOption is set if only applyState exists
            user.lastOption = "apply";
            await user.save();
            logger.info(`Ensured lastOption='apply' for user ${user.phoneNumber} due to existing applyState`);
        }
        logger.info(`Delegating to applyModule for ${userPhone}`);
        await applyModule.process(sanitizedBody, user, From);
        return res.sendStatus(200);
    }

    if (user.lastOption === "chat") {
      if (lower === "back" || lower === "0") {
        logger.info(`Handling back/0 from chat mode for ${userPhone}`);
        user.lastOption = null;
        await user.save();
        await optionModule.prompt(user, From);
        return res.sendStatus(200);
      }
      logger.info(`Delegating to chatModule for ${userPhone}`);
      await chatModule.process(sanitizedBody, user, From);
      return res.sendStatus(200);
    }


    // Fallback
    logger.warn(`Unhandled input "${sanitizedBody}" for ${userPhone} in state: lang=${user.language}, option=${user.lastOption}, apply=${user.applyState}`);
    const fallbackMsg = user.language === 'malayalam'
       ? "ക്ഷമിക്കണം, എനിക്ക് മനസ്സിലായില്ല. വീണ്ടും തുടങ്ങാൻ 'hi' എന്ന് ടൈപ്പ് ചെയ്യുക."
       : "Sorry, I didn't understand that. Type 'hi' to restart.";
    await sendMessage(From, fallbackMsg);
    return res.sendStatus(200);
  };

  // ─── HANDLER: Delivery status callbacks ─────────────────────────────────────
  const handleStatusCallback = (req, res) => {
    // Minimal logging for status callbacks unless debugging needed
    // logger.info(`Message SID ${req.body.MessageSid} status: ${req.body.MessageStatus}`);
    res.sendStatus(200);
  };

  return { handleMessage, handleStatusCallback };
};