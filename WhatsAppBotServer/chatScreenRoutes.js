// chatScreenRoutes.js
const express = require('express');
const axios = require('axios'); // Needed for global /cancel API call
const WhaUser = require('./models/wha-user');
const Chat = require('./models/chat');
// Import module factories
const languageModuleFactory = require('./controllers/modules/languageModule');
const optionModuleFactory = require('./controllers/modules/optionModule');
const chatModuleFactory = require('./controllers/modules/chatModule');
const applyModuleFactory = require('./controllers/modules/applyModule');
// Uncomment if you want /service command to work
const statusModuleFactory = require('./controllers/modules/statusModule');


module.exports = function({ logger, CHAT_API_BASE, AXIOS_TIMEOUT, DOCUMENT_SERVICE_API_BASE }) {
    const router = express.Router();

    // --- User State Management (Remains the same) ---
    const getUserState = async (userId) => {
        if (!userId || typeof userId !== 'string') {
             logger.warn(`Invalid or missing userId: ${userId}`);
             return null;
         }
        let user = await WhaUser.findOne({ phoneNumber: userId });
        if (!user) {
            logger.info(`Creating new user state for ${userId}`);
            user = new WhaUser({ phoneNumber: userId, lastOption: null, language: null, applyState: null, applyDataTemp: {}, applications: [] });
            user.applyDataTemp = user.applyDataTemp || {}; user.applications = user.applications || [];
            await user.save();
        } else {
            user.applyDataTemp = user.applyDataTemp || {}; user.applications = user.applications || [];
        }
        return user;
    };

    // --- Helper to store chat messages (Remains the same) ---
    const storeChatMessage = async (userPhone, message, direction) => {
        try {
            const sanitizedMessage = typeof message === 'string' ? message.replace(/<script.*?>.*?<\/script>/gi, '') : '';
             if (sanitizedMessage) {
                 const savedMsg = await Chat.create({ userPhone, message: sanitizedMessage, direction });
                 return savedMsg;
            } else { logger.warn(`Attempted to store empty/non-string message for ${userPhone}`); return null; }
        } catch (err) { logger.error(`Error storing chat for ${userPhone}:`, err); return null; }
    };

    // --- sendMessage Wrapper (Remains the same) ---
    const createCaptureSendMessage = (userId) => {
        let replies = [];
        const func = async (to, body) => {
            const message = typeof body === 'string' ? body : JSON.stringify(body);
            replies.push(message);
            await storeChatMessage(userId, message, 'outbound');
            logger.info(`(Capture Send) Storing reply for ${userId}: ${message.substring(0, 50)}...`);
            return Promise.resolve();
        };
        func.getReplies = () => replies; func.clearReplies = () => { replies = []; };
        return func;
    };

    // --- API Routes ---

    // GET /api/chat/start (Remains the same)
    router.get('/start', async (req, res) => {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: 'User phone number is required to start.', initialReplies: [] });
        logger.info(`Starting/Resuming session for ${userId}`);
        const user = await getUserState(userId);
        if (!user) return res.status(500).json({ error: 'Could not initialize user session.', initialReplies: [] });
        const captureSendMessage = createCaptureSendMessage(userId);
        const languageModule = languageModuleFactory(captureSendMessage, logger);
        const optionModule = optionModuleFactory(captureSendMessage, null, CHAT_API_BASE, logger, AXIOS_TIMEOUT);
        try {
            if (!user.language) { await languageModule.prompt(userId); }
            else if (!user.lastOption && !user.applyState) { await optionModule.prompt(user, userId); }
            else { logger.info(`User ${userId} session resumed in state: lang=${user.language}, option=${user.lastOption}, apply=${user.applyState}. No initial prompt sent.`); }
            res.json({ userId: user.phoneNumber, initialReplies: captureSendMessage.getReplies(), currentState: { language: user.language, lastOption: user.lastOption, applyState: user.applyState } });
        } catch (error) { logger.error(`Error starting session logic for ${userId}:`, error); captureSendMessage.clearReplies(); res.status(500).json({ error: 'Could not process start request.', userId: userId, initialReplies: [] }); }
    });

    // POST /api/chat/send (Enhanced Logic)
    router.post('/send', async (req, res) => {
        const { message, userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'User ID is required.' });
        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Message cannot be empty.' });
        }

        const userQuery = message.trim();
        const lowerQuery = userQuery.toLowerCase();
        logger.info(`Processing input for ${userId}: "${userQuery}"`);

        const user = await getUserState(userId);
        if (!user) return res.status(500).json({ replies: ['Sorry, there was a problem retrieving your session. Please refresh.'] });

        const captureSendMessage = createCaptureSendMessage(userId);
        // Instantiate all potentially needed modules
        const languageModule = languageModuleFactory(captureSendMessage, logger);
        const applyModule = applyModuleFactory(captureSendMessage, DOCUMENT_SERVICE_API_BASE, logger, AXIOS_TIMEOUT);
        const optionModule = optionModuleFactory(captureSendMessage, applyModule, CHAT_API_BASE, logger, AXIOS_TIMEOUT);
        const chatModule = chatModuleFactory(captureSendMessage, CHAT_API_BASE, logger, AXIOS_TIMEOUT);
        // Instantiate status module if using /service command
        const statusModule = statusModuleFactory(captureSendMessage, DOCUMENT_SERVICE_API_BASE, logger, AXIOS_TIMEOUT);


        let savedInboundMsg = null;
        let commandHandled = false; // Flag to track if a global command was processed

        try {
            savedInboundMsg = await storeChatMessage(userId, userQuery, 'inbound');

            // --- Global Command Handling (Mimic chatbotController) ---
            if (lowerQuery === "/lang") {
                logger.info(`Handling /lang command for ${userId}`);
                user.language = null; user.lastOption = null; user.applyState = null; user.applyDataTemp = {};
                await languageModule.prompt(userId);
                commandHandled = true;
            }
            else if (lowerQuery === "/service") {
                 logger.info(`Handling /service command for ${userId}`);
                 if (!user.language) { // Need language first
                     await languageModule.prompt(userId);
                 } else {
                     await statusModule.checkAll(user, userId);
                     // Show main menu again after status check
                     await optionModule.prompt(user, userId);
                 }
                 commandHandled = true;
            }
            else if (lowerQuery === "/cancel") {
                logger.info(`Handling /cancel command for ${userId}`);
                 if (!user.language) { await languageModule.prompt(userId); commandHandled = true; } // Need language
                 else {
                     const apps = Array.isArray(user.applications) ? user.applications : [];
                     // Find most recent request (can be refined)
                     const lastActiveRequest = apps.slice().reverse().find(app => app.serviceRequestId);

                     if (lastActiveRequest?.serviceRequestId && DOCUMENT_SERVICE_API_BASE) {
                         try {
                             logger.info(`Attempting to cancel request ${lastActiveRequest.serviceRequestId} via /cancel for ${userId}`);
                             await axios.post(
                                 `${DOCUMENT_SERVICE_API_BASE}/service-request/${lastActiveRequest.serviceRequestId}/cancel`,
                                 null, { timeout: AXIOS_TIMEOUT }
                             );
                             // Remove from user record locally
                             user.applications = user.applications.filter(a => a.serviceRequestId !== lastActiveRequest.serviceRequestId);
                             await captureSendMessage(userId, user.language === 'malayalam'
                                 ? `❌ നിങ്ങളുടെ അവസാന സേവന അഭ്യർത്ഥന (${lastActiveRequest.serviceRequestId}) റദ്ദാക്കിയിരിക്കുന്നു.`
                                 : `❌ Your last service request (${lastActiveRequest.serviceRequestId}) has been cancelled.`);
                         } catch (err) {
                             logger.error(`Error cancelling request ${lastActiveRequest.serviceRequestId} via /cancel API:`, err.response?.data || err.message);
                             if (err.response?.status === 400 || err.response?.status === 404) {
                                 await captureSendMessage(userId, user.language === 'malayalam' ? `ℹ️ അഭ്യർത്ഥന (${lastActiveRequest.serviceRequestId}) റദ്ദാക്കാൻ കഴിഞ്ഞില്ല (ഒരുപക്ഷേ ഇതിനകം റദ്ദാക്കിയിരിക്കാം).` : `ℹ️ Request (${lastActiveRequest.serviceRequestId}) could not be cancelled (may already be cancelled/completed).`);
                             } else {
                                 await captureSendMessage(userId, user.language === 'malayalam' ? "❌ അഭ്യർത്ഥന റദ്ദാക്കുന്നതിൽ പിശക് സംഭവിച്ചു." : '❌ An error occurred trying to cancel the request.');
                             }
                         }
                     } else {
                         await captureSendMessage(userId, user.language === 'malayalam' ? "റദ്ദാക്കാൻ സമീപകാലത്തുള്ള സേവന അഭ്യർത്ഥനകളൊന്നും കണ്ടെത്താനായില്ല." : "No recent service requests found to cancel.");
                     }
                     // Reset state and show main menu after attempting cancel
                     user.lastOption = null; user.applyState = null; user.applyDataTemp = {};
                     await optionModule.prompt(user, userId);
                     commandHandled = true;
                 }
            }

            // --- Standard State Flow (Only if no global command was handled) ---
            if (!commandHandled) {
                // Greetings / Menu Reset Keywords
                 const greetings = ["hi", "hello", "hai", "hey", "menu", "start", "help", "options", "ഹലോ", "ഹായ്", "നമസ്കാരം", "നമസ്‌തേ"];
                 if (greetings.includes(lowerQuery)) {
                     logger.info(`Handling greeting/reset for ${userId}`);
                     user.lastOption = null; user.applyState = null; user.applyDataTemp = {};
                     if (!user.language) { await languageModule.prompt(userId); }
                     else { await optionModule.prompt(user, userId); }
                 }
                 // 1. Language Selection
                 else if (!user.language) {
                     await languageModule.choose(userQuery, user, userId);
                 }
                 // 2. Main Menu Selection
                 else if (!user.lastOption && !user.applyState) {
                     await optionModule.choose(userQuery, user, userId);
                 }
                 // 3. Delegate to Active Module
                 else {
                      if (user.applyState || user.lastOption === "apply") {
                           if (user.lastOption !== "apply" && user.applyState) user.lastOption = "apply";
                           logger.info(`Delegating to applyModule for ${userId}`);
                           await applyModule.process(userQuery, user, userId);
                       } else if (user.lastOption === "chat") {
                            if (lowerQuery === "back" || lowerQuery === "0") {
                                logger.info(`Handling back/0 from chat mode for ${userId}`);
                                user.lastOption = null;
                                await optionModule.prompt(user, userId);
                            } else {
                                 logger.info(`Delegating to chatModule for ${userId}`);
                                 await chatModule.process(userQuery, user, userId);
                            }
                        }
                        // 4. Fallback for unrecognized input within a known state
                        else {
                             logger.warn(`Unhandled input "${userQuery}" for ${userId} in state: lang=${user.language}, option=${user.lastOption}, apply=${user.applyState}`);
                             const fallbackMsg = user.language === 'malayalam'
                                ? "ക്ഷമിക്കണം, എനിക്ക് മനസ്സിലായില്ല. പ്രധാന മെനു കാണുന്നതിന് 'hi' എന്ന് ടൈപ്പ് ചെയ്യുക."
                                : "Sorry, I didn't understand that. Type 'hi' to see the main menu.";
                             await captureSendMessage(userId, fallbackMsg);
                             // Optionally force back to main menu prompt
                             // user.lastOption = null; user.applyState = null; user.applyDataTemp = {};
                             // await optionModule.prompt(user, userId);
                        }
                 }
            }
            // --- End Standard State Flow ---

            await user.save();

            res.json({
                inboundMessageId: savedInboundMsg ? savedInboundMsg._id.toString() : null,
                replies: captureSendMessage.getReplies()
            });

        } catch (error) {
            logger.error(`Critical error processing message for ${userId}:`, error);
             try { await user.save(); } catch (saveErr) { logger.error("Failed to save user state after critical error:", saveErr); }
            const errorMsg = user?.language === 'malayalam' ? "ക്ഷമിക്കണം, ഒരു പ്രധാന പിശക് സംഭവിച്ചു." : "Sorry, a critical error occurred.";
            res.status(500).json({ replies: [errorMsg] });
        }
    });

    // GET /api/chat/history (Remains the same)
    router.get('/history', async (req, res) => {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: 'User ID is required for history.' });
        logger.info(`Fetching history for ${userId}`);
        try {
            const history = await Chat.find({ userPhone: userId }).sort({ timestamp: 1 }).limit(150).lean();
            history.forEach(msg => { if(msg._id) msg._id = msg._id.toString(); });
            res.json(history);
        } catch (error) { logger.error(`Error fetching history for ${userId}:`, error); res.status(500).json({ error: 'Could not fetch chat history.' }); }
    });

    // DELETE /api/chat/message/:messageId (Remains the same)
    router.delete('/message/:messageId', async (req, res) => {
        const { messageId } = req.params;
        const userId = req.query.userId || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'User ID required for deletion.' });
        if (!messageId) return res.status(400).json({ error: 'Message ID required.' });
        logger.info(`Attempting to delete message ${messageId} for user ${userId}`);
        try {
            const message = await Chat.findOne({ _id: messageId, userPhone: userId, direction: 'inbound' });
            if (!message) { logger.warn(`Message ${messageId} not found or user ${userId} not authorized.`); return res.status(404).json({ error: 'Message not found or deletion not allowed.' }); }
            await Chat.deleteOne({ _id: messageId });
            logger.info(`Message ${messageId} deleted successfully.`);
            res.status(200).json({ success: true, message: 'Message deleted.' });
        } catch (error) { logger.error(`Error deleting message ${messageId} for user ${userId}:`, error); if (error.kind === 'ObjectId') return res.status(400).json({ error: 'Invalid Message ID format.' }); res.status(500).json({ error: 'Could not delete message.' }); }
    });

    return router;
};