// chatScreenRoutes.js
const express = require('express');
const WhaUser = require('./models/wha-user'); // Use the existing user model for state
const Chat = require('./models/chat');
// Import module factories
const languageModuleFactory = require('./controllers/modules/languageModule');
const optionModuleFactory = require('./controllers/modules/optionModule');
const chatModuleFactory = require('./controllers/modules/chatModule');
const applyModuleFactory = require('./controllers/modules/applyModule');
// You might need statusModule if commands like /service are intended for the web chat
// const statusModuleFactory = require('./controllers/modules/statusModule');


module.exports = function({ logger, CHAT_API_BASE, AXIOS_TIMEOUT, DOCUMENT_SERVICE_API_BASE }) {
    const router = express.Router();

    // --- User State Management (Corrected) ---
    const getUserState = async (userId) => {
        // Basic validation for userId format (RELAXED: removed startsWith('+') check)
        if (!userId || typeof userId !== 'string' /* || !userId.startsWith('+') */ ) { // Removed strict '+' check
             logger.warn(`Invalid or missing userId format (check relaxed): ${userId}`);
             // Still return null if fundamentally invalid (e.g., not a string, empty)
             if (!userId || typeof userId !== 'string') return null;
         }

        // Ensure userId is treated consistently (e.g., always include '+') if needed later
        // You might want to normalize the number here if needed for other APIs
        // const normalizedUserId = userId.startsWith('+') ? userId : '+' + userId; // Example normalization

        let user = await WhaUser.findOne({ phoneNumber: userId }); // Query using the provided userId
        if (!user) {
            logger.info(`Creating new user state for ${userId}`);
            user = new WhaUser({
                phoneNumber: userId, // Store the provided userId
                lastOption: null,
                language: null,
                applyState: null,
                applyDataTemp: {},
                applications: []
            });
            // Ensure nested objects are initialized
            user.applyDataTemp = user.applyDataTemp || {};
            user.applications = user.applications || [];
            await user.save();
        } else {
            // Ensure nested objects exist even if loading from DB
            user.applyDataTemp = user.applyDataTemp || {};
            user.applications = user.applications || [];
        }
        return user;
    };


    // --- Helper to store chat messages ---
    const storeChatMessage = async (userPhone, message, direction) => {
        try {
            const sanitizedMessage = typeof message === 'string' ? message.replace(/<script.*?>.*?<\/script>/gi, '') : '';
             if (sanitizedMessage) {
                 // Storing returns the created document, including its _id
                 const savedMsg = await Chat.create({ userPhone, message: sanitizedMessage, direction });
                 return savedMsg; // Return the saved message object
            } else {
                 logger.warn(`Attempted to store empty/non-string message for ${userPhone}`);
                 return null;
             }
        } catch (err) {
            logger.error(`Error storing chat for ${userPhone}:`, err);
            return null;
        }
    };

    // --- sendMessage Wrapper to Capture Multiple Replies ---
    const createCaptureSendMessage = (userId) => {
        let replies = [];
        const func = async (to, body) => {
            const message = typeof body === 'string' ? body : JSON.stringify(body);
            replies.push(message);
            await storeChatMessage(userId, message, 'outbound');
            logger.info(`(Capture Send) Storing reply for ${userId}: ${message.substring(0, 50)}...`);
            return Promise.resolve();
        };
        func.getReplies = () => replies;
        func.clearReplies = () => { replies = []; };
        return func;
    };

    // --- API Routes ---

    // GET /api/chat/start
    router.get('/start', async (req, res) => {
        const userId = req.query.userId;
        if (!userId) {
            logger.warn("User ID missing in /start request");
            return res.status(400).json({ error: 'User phone number is required to start.', initialReplies: [] });
        }
        logger.info(`Starting/Resuming session for ${userId}`);

        const user = await getUserState(userId);
         // Handle case where user state couldn't be fetched/created (e.g., invalid non-string userId)
         if (!user) {
            logger.error(`Could not get or create user state for ${userId} - likely invalid format passed validation`);
             return res.status(500).json({ error: 'Could not initialize user session.', initialReplies: [] });
         }

        const captureSendMessage = createCaptureSendMessage(userId);
        const languageModule = languageModuleFactory(captureSendMessage, logger);
        const optionModule = optionModuleFactory(captureSendMessage, null, CHAT_API_BASE, logger, AXIOS_TIMEOUT);

        try {
            // --- Determine if initial prompts are needed ---
            if (!user.language) {
                logger.info(`User ${userId} needs language selection. Prompting.`);
                await languageModule.prompt(userId); // Prompt for language
            } else if (!user.lastOption && !user.applyState) {
                // Only prompt main menu if language is set AND user is not in any specific flow
                logger.info(`User ${userId} needs main menu selection. Prompting.`);
                await optionModule.prompt(user, userId); // Prompt main menu
            } else {
                // User has language set and is either in a flow (applyState)
                // or has chosen an option (lastOption = chat/apply).
                // No initial prompt needed from /start endpoint in these cases.
                logger.info(`User ${userId} session resumed in state: lang=${user.language}, option=${user.lastOption}, apply=${user.applyState}. No initial prompt sent.`);
            }
            // --- End Prompt Logic ---

            // Send back userId and any prompts *explicitly generated above*
            res.json({
                userId: user.phoneNumber,
                initialReplies: captureSendMessage.getReplies(), // Only contains prompts if generated above
                currentState: {
                    language: user.language,
                    lastOption: user.lastOption,
                    applyState: user.applyState
                }
            });

        } catch (error) {
             logger.error(`Error starting session logic for ${userId}:`, error);
             captureSendMessage.clearReplies(); // Ensure no replies sent on error
             res.status(500).json({
                 error: 'Could not process start request.', // More specific error might be possible
                 userId: userId,
                 initialReplies: []
             });
         }
    });

    // POST /api/chat/send
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
         if (!user) {
             logger.error(`Could not get user state for ${userId} during send.`);
             return res.status(500).json({ replies: ['Sorry, there was a problem retrieving your session. Please refresh.'] });
         }

        const captureSendMessage = createCaptureSendMessage(userId);

        // Instantiate modules
        const languageModule = languageModuleFactory(captureSendMessage, logger);
        const applyModule = applyModuleFactory(captureSendMessage, DOCUMENT_SERVICE_API_BASE, logger, AXIOS_TIMEOUT);
        const optionModule = optionModuleFactory(captureSendMessage, applyModule, CHAT_API_BASE, logger, AXIOS_TIMEOUT);
        const chatModule = chatModuleFactory(captureSendMessage, CHAT_API_BASE, logger, AXIOS_TIMEOUT);

        let savedInboundMsg = null; // To store the user's message object including _id

        try {
            // Store user's message first and get its ID
            savedInboundMsg = await storeChatMessage(userId, userQuery, 'inbound');

            // --- State-Based Logic ---
            if (!user.language) {
                await languageModule.choose(userQuery, user, userId);
            } else if (!user.lastOption && !user.applyState) {
                 const greetings = ["hi", "hello", "hai", "hey", "menu", "start", "help", "options", "ഹലോ", "ഹായ്", "നമസ്കാരം", "നമസ്‌തേ"];
                 if (greetings.includes(lowerQuery)) {
                     user.lastOption = null; user.applyState = null; user.applyDataTemp = {};
                     await optionModule.prompt(user, userId);
                 } else {
                     await optionModule.choose(userQuery, user, userId);
                 }
            } else {
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
                   } else {
                        logger.warn(`Inconsistent state for ${userId}. Resetting.`);
                        user.lastOption = null; user.applyState = null; user.applyDataTemp = {};
                        await optionModule.prompt(user, userId);
                   }
            }
            // --- End State-Based Logic ---

            await user.save();

            res.json({
                // Include the ID of the user's saved message for tick/delete linking
                inboundMessageId: savedInboundMsg ? savedInboundMsg._id.toString() : null, // Send ID as string
                replies: captureSendMessage.getReplies()
            });

        } catch (error) {
            logger.error(`Error processing message for ${userId}:`, error);
             try { await user.save(); } catch (saveErr) { logger.error("Failed to save user state after error:", saveErr); }
            const errorMsg = user?.language === 'malayalam' ? "ക്ഷമിക്കണം, ഒരു പിശക് സംഭവിച്ചു." : "Sorry, an internal error occurred processing your request.";
            res.status(500).json({ replies: [errorMsg] });
        }
    });

    // GET /api/chat/history
    router.get('/history', async (req, res) => {
        const userId = req.query.userId;
        if (!userId) return res.status(400).json({ error: 'User ID is required for history.' });
        logger.info(`Fetching history for ${userId}`);
        try {
            // Convert _id to string if needed by frontend directly
            const history = await Chat.find({ userPhone: userId })
                                       .sort({ timestamp: 1 })
                                       .limit(150)
                                       .lean(); // Use lean for plain objects
            history.forEach(msg => { if(msg._id) msg._id = msg._id.toString(); }); // Ensure ID is string
            res.json(history);
        } catch (error) {
            logger.error(`Error fetching history for ${userId}:`, error);
            res.status(500).json({ error: 'Could not fetch chat history.' });
        }
    });

    // DELETE /api/chat/message/:messageId
    router.delete('/message/:messageId', async (req, res) => {
        const { messageId } = req.params;
        const userId = req.query.userId || req.body.userId;

        if (!userId) return res.status(401).json({ error: 'User ID required for deletion.' });
        if (!messageId) return res.status(400).json({ error: 'Message ID required.' });

        logger.info(`Attempting to delete message ${messageId} for user ${userId}`);
        try {
            const message = await Chat.findOne({ _id: messageId, userPhone: userId, direction: 'inbound' });
            if (!message) {
                logger.warn(`Message ${messageId} not found or user ${userId} not authorized.`);
                return res.status(404).json({ error: 'Message not found or deletion not allowed.' });
            }
            await Chat.deleteOne({ _id: messageId });
            logger.info(`Message ${messageId} deleted successfully.`);
            res.status(200).json({ success: true, message: 'Message deleted.' });
        } catch (error) {
            logger.error(`Error deleting message ${messageId} for user ${userId}:`, error);
            if (error.kind === 'ObjectId') return res.status(400).json({ error: 'Invalid Message ID format.' });
            res.status(500).json({ error: 'Could not delete message.' });
        }
    });

    return router;
};