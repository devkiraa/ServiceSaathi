// controllers/chatbotController.js
const Chat = require('../models/chat');
const User = require('../models/wha-user');
const client = require('../config/twilio');
const axios = require('axios'); // <<--- Add axios import here
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
  // NOTE: We need applyModule reference *inside* handleMessage for the improved /cancel logic
  const languageModule = require('./modules/languageModule')(sendMessage, logger);
  // Don't pass applyModule here yet
  const optionModule = require('./modules/optionModule')(sendMessage, /* applyModule */ null, CHAT_API_BASE, logger, AXIOS_TIMEOUT);
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
        user.applyDataTemp = user.applyDataTemp || {}; // Ensure objects exist even if empty in DB
        user.applications = user.applications || [];
        await user.save();
      } else {
         // Ensure objects exist even if user loaded from DB
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

    // --- Load Apply Module here, now that we have user/config ---
    // This allows access to its functions/state if needed for /cancel
    const applyModule = require('./modules/applyModule')(sendMessage, DOCUMENT_SERVICE_API_BASE, logger, AXIOS_TIMEOUT);


    // --- Global Commands Handling ---
    // These commands should interrupt any other flow

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
      // After checking status, it's good practice to show the main menu again
      // unless the status module explicitly indicates otherwise.
      // For now, let's assume status check doesn't change the core state.
      // Re-prompt main menu to guide the user.
      await optionModule.prompt(user, From);
      return res.sendStatus(200);
    }

    // ****** NEW /cancel Global Handling ******
    if (lower === '/cancel') {
        logger.info(`Handling global /cancel command for ${userPhone}`);
        // Attempt to cancel the last request using logic similar to applyModule
        const apps = Array.isArray(user.applications) ? user.applications : [];
        // Find the most recent request that hasn't been explicitly marked completed/cancelled in *our* record
        // Note: This doesn't query the API for the *actual* current status before attempting cancel.
        const lastActiveRequest = apps.slice().reverse().find(app => app.serviceRequestId /* && !['completed', 'cancelled', 'rejected', 'failed'].includes(app.status) */); // Add status check if you track it reliably in user.applications

        if (lastActiveRequest && lastActiveRequest.serviceRequestId) {
            try {
                logger.info(`User ${user.phoneNumber} attempting to cancel request ${lastActiveRequest.serviceRequestId} via global /cancel`);
                await axios.post(
                    `${DOCUMENT_SERVICE_API_BASE}/service-request/${lastActiveRequest.serviceRequestId}/cancel`,
                    null, // No body needed for cancel usually
                    { timeout: AXIOS_TIMEOUT }
                );

                // **Important**: Need a way to stop polling if active.
                // This might require applyModule to expose a function or manage polls differently.
                // Simple approach: Log that polling might continue until timeout/API update.
                logger.warn(`Polling for request ${lastActiveRequest.serviceRequestId} might still be active. It should stop on next API check or timeout.`);
                // TODO: Refactor polling management if immediate stop is critical.

                // Update local record (optional: mark as cancelled, or just remove)
                user.applications = apps.filter(a => a.serviceRequestId !== lastActiveRequest.serviceRequestId);

                await sendMessage(From, user.language === 'malayalam'
                    ? `❌ നിങ്ങളുടെ അവസാന സേവന അഭ്യർത്ഥന (${lastActiveRequest.serviceRequestId}) റദ്ദാക്കിയിരിക്കുന്നു.`
                    : `❌ Your last service request (${lastActiveRequest.serviceRequestId}) has been cancelled.`);

            } catch (err) {
                // Log API error
                logger.error(`Error cancelling request ${lastActiveRequest.serviceRequestId} via global /cancel API:`, err.response?.data || err.message);
                 // Check if it's already cancelled or in a non-cancellable state
                 if (err.response && err.response.status === 400) { // Example: Bad Request might mean already cancelled/completed
                     await sendMessage(From, user.language === 'malayalam'
                         ? `ℹ️ നിങ്ങളുടെ അവസാന അഭ്യർത്ഥന (${lastActiveRequest.serviceRequestId}) ഇതിനകം റദ്ദാക്കുകയോ പൂർത്തിയാക്കുകയോ ചെയ്തിരിക്കാം.`
                         : `ℹ️ Your last request (${lastActiveRequest.serviceRequestId}) may already be cancelled or completed.`);
                 } else {
                    await sendMessage(From, user.language === 'malayalam'
                        ? "അവസാന അഭ്യർത്ഥന റദ്ദാക്കുന്നതിൽ ഒരു പിശക് സംഭവിച്ചു. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക."
                        : 'An error occurred while trying to cancel the last request. Please try again later.');
                 }
            }
        } else {
             // Only inform if they weren't in an active apply flow state
             // (applyModule handles its own 'cancel' command for the *interactive* flow)
             if (!user.applyState) {
                await sendMessage(From, user.language === 'malayalam'
                    ? "റദ്ദാക്കാൻ സമീപകാലത്തുള്ള സേവന അഭ്യർത്ഥനകളൊന്നും നിങ്ങളുടെ രേഖകളിലില്ല."
                    : "You have no recent service requests on record to cancel.");
             } else {
                 // If they were in applyState, let applyModule handle '0' or 'back' or this '/cancel'
                 // Pass control to applyModule below
             }
        }

        // ALWAYS reset state and show main menu after handling global /cancel
        // (unless they were in applyState - applyModule should handle its own reset)
        if (!user.applyState) {
            user.lastOption = null;
            // applyState is already null
            user.applyDataTemp = {};
            await user.save();
            logger.info(`State reset after global /cancel for ${userPhone}`);
            await optionModule.prompt(user, From);
            return res.sendStatus(200); // Stop processing this message
        }
        // If user was in applyState, let it fall through to applyModule handler below
        // ApplyModule's own '/cancel' or '0' logic will handle state reset and menu prompt.
        logger.info(`Passing /cancel to applyModule as user was in state: ${user.applyState}`);

    }
    // ****** END NEW /cancel Global Handling ******


    // --- Standard Flow ---

    // Greeting / Menu Reset
    if (
      // Original English & Malayalam
      lower === "hi" ||
      lower === "hello" ||
      lower === "hai" || // Common alternative spelling/pronunciation
      lower === "ഹലോ" || // Malayalam: hello
      lower === "ഹായ്" || // Malayalam: hi
  
      // Added English Variations
      lower === "hey" || // Very common informal greeting
      lower === "helo" || // Common typo for hello
      lower === "hallo" || // Another variation/typo
      lower === "greeting" || // More formal
      lower === "greetings" || // Plural form
  
      // Added Time-Based English Greetings
      lower === "good morning" ||
      lower === "good afternoon" ||
      lower === "good evening" ||
  
      // Added Common Indian Greetings (often used across languages)
      lower === "namaste" || // Widely recognized
      lower === "namaskaram" || // Common in South India
  
      // Added Malayalam Formal Greetings
      lower === "നമസ്കാരം" || // Malayalam: Namaskaram
      lower === "നമസ്‌തേ" || // Malayalam: Namaste
  
      // Original non-greeting term
      lower === "menu" ||
  
      // Added related terms often used to start
      lower === "start" ||
      lower === "help" ||
      lower === "options" // Similar intent to 'menu'
  ) {
      logger.info(`Handling greeting/menu request for ${userPhone}`);
      // Reset state completely
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
      // languageModule.choose now calls optionModule.prompt automatically on success
      return res.sendStatus(200);
    }

    // STEP 2: Main option selection (only if no specific flow is active)
    if (!user.lastOption && !user.applyState) {
       logger.info(`Handling main option selection for ${userPhone}`);
       // Pass the dynamically loaded applyModule to optionModule now
       const populatedOptionModule = require('./modules/optionModule')(sendMessage, applyModule, CHAT_API_BASE, logger, AXIOS_TIMEOUT);
       await populatedOptionModule.choose(sanitizedBody, user, From);
       return res.sendStatus(200);
    }

    // STEP 3: Delegate to active module

    // Check Apply flow first (includes handling '0', 'back', and potentially '/cancel' passed down from global check)
    if (user.applyState || user.lastOption === "apply") {
        // Ensure lastOption is sync'd if only applyState exists (e.g., after bot restart)
        if (user.lastOption !== "apply") {
            user.lastOption = "apply";
            await user.save();
            logger.info(`Ensured lastOption='apply' for user ${user.phoneNumber} due to existing applyState`);
        }
        logger.info(`Delegating to applyModule for ${userPhone}`);
        await applyModule.process(sanitizedBody, user, From); // applyModule handles its own state changes & menu prompts
        return res.sendStatus(200);
    }

    // Check Chat flow
    if (user.lastOption === "chat") {
      // Handle 'back' or '0' specifically for exiting chat mode
      if (lower === "back" || lower === "0") {
        logger.info(`Handling back/0 from chat mode for ${userPhone}`);
        user.lastOption = null; // Exit chat mode
        await user.save();
        await optionModule.prompt(user, From); // Show main menu
        return res.sendStatus(200);
      }
      // Otherwise, process as chat input
      logger.info(`Delegating to chatModule for ${userPhone}`);
      await chatModule.process(sanitizedBody, user, From);
      return res.sendStatus(200);
    }


    // Fallback: Unhandled state or input
    logger.warn(`Unhandled input "${sanitizedBody}" for ${userPhone} in state: lang=${user.language}, option=${user.lastOption}, apply=${user.applyState}`);
    // Offer main menu as a way out
    const fallbackMsg = user.language === 'malayalam'
       ? "ക്ഷമിക്കണം, എനിക്ക് മനസ്സിലായില്ല. പ്രധാന മെനു കാണുന്നതിന് 'hi' എന്ന് ടൈപ്പ് ചെയ്യുക."
       : "Sorry, I didn't understand that. Type 'hi' to see the main menu.";
    await sendMessage(From, fallbackMsg);
    // Optionally reset state here? Maybe safer not to, let user type 'hi'.
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