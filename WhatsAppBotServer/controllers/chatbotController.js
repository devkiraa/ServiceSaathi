const User = require('../models/user');
const Chat = require('../models/chat');
const client = require('../config/twilio');
const axios = require('axios');

const BOT_NAME = "SERVICE SAATHI";

// Base API URLs (without endpoints)
const CHAT_API_BASE = "https://ef02-34-32-230-121.ngrok-free.app";
const TRANSLATE_API_BASE = "https://593c-34-44-123-63.ngrok-free.app";

// Helper: Store chat message in DB
const storeChatMessage = async (userPhone, message, direction) => {
    try {
        await Chat.create({ userPhone, message, direction });
    } catch (error) {
        console.error("Error storing chat message:", error);
    }
};

// Helper: Translate text using external API
const translateText = async (text, mode) => {
    try {
        const response = await axios.post(`${TRANSLATE_API_BASE}/translate`, { text, mode });
        if (response.data && response.data.response) {
            return response.data.response;
        }
        return text;
    } catch (error) {
        console.error("Translation error:", error);
        return text;
    }
};

// Function to send a WhatsApp message and store outbound chat
const sendMessage = async (to, body) => {
    try {
        // Ensure 'to' is correctly formatted as a WhatsApp number
        if (!to.startsWith("whatsapp:")) {
            to = `whatsapp:${to}`;
        }
        await client.messages.create({
            from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
            to: to,
            body: body
        });
        // Store outbound message
        await storeChatMessage(to.replace('whatsapp:', ''), body, 'outbound');
    } catch (error) {
        console.error("Error sending message:", error);
    }
};

// Main function to handle incoming WhatsApp messages
const handleMessage = async (req, res) => {
    const { Body, From } = req.body;
    // Remove "whatsapp:" prefix for processing and storage
    const userPhone = From.replace('whatsapp:', '').trim();
    
    // Ignore empty messages or accidental "ok" messages
    if (!Body || Body.trim() === "" || Body.trim().toLowerCase() === "ok") {
        return res.status(200).end();
    }

    // Store the incoming message
    await storeChatMessage(userPhone, Body, 'inbound');

    try {
        let user = await User.findOne({ phoneNumber: userPhone });

        // If user doesn't exist, create a new one
        if (!user) {
            user = new User({ phoneNumber: userPhone, lastOption: null, language: null });
            await user.save();
        }

        // Check for language change command
        if (Body.trim().toUpperCase() === "/LANG") {
            // Reset language and session option (but keep the phone number)
            user.language = null;
            user.lastOption = null;
            await user.save();
            const resetMsg = `${BOT_NAME}: Language preference reset. Please choose your language:\n1️⃣ English\n2️⃣ Malayalam`;
            await sendMessage(From, resetMsg);
            return res.status(200).end();
        }

        // Check for "back" command (or "0") to return to main menu if an option was already selected
        if (user.lastOption && (Body.trim().toLowerCase() === "0" || Body.trim().toLowerCase() === "back")) {
            user.lastOption = null;
            await user.save();
            const menuMsg = user.language === "malayalam" ?
                `${BOT_NAME}: പ്രധാന മെനുവിലേക്ക് തിരികെ പോവുന്നു. ദയവായി ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക:\n1️⃣ ചാറ്റ്\n2️⃣ ഡോക്യുമെന്റ് അപേക്ഷ` :
                `${BOT_NAME}: Returning to main menu. Please choose an option:\n1️⃣ Chat\n2️⃣ Apply for Document`;
            await sendMessage(From, menuMsg);
            return res.status(200).end();
        }

        // STEP 1: LANGUAGE SELECTION (if not set)
        if (!user.language) {
            if (Body.toLowerCase() === "hi") {
                // Stylish greeting with language selection prompt
                const greet = `${BOT_NAME}: ✨ Welcome to SERVICE SAATHI - Akshaya Centre! ✨\nPlease choose your language:\n1️⃣ English\n2️⃣ Malayalam`;
                await sendMessage(From, greet);
            } else if (Body.trim() === "1") {
                user.language = "english";
                await user.save();
                const greetEng = `${BOT_NAME}: Hello! Welcome to SERVICE SAATHI.\nPlease choose an option:\n1️⃣ Chat\n2️⃣ Apply for Document\n(To change language at any time, send /LANG)`;
                await sendMessage(From, greetEng);
            } else if (Body.trim() === "2") {
                user.language = "malayalam";
                await user.save();
                const greetMal = `${BOT_NAME}: ഹലോ! SERVICE SAATHI - ആകശ്യ സെന്ററിലേക്ക് സ്വാഗതം.\nദയവായി ഒരു ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക:\n1️⃣ ചാറ്റ്\n2️⃣ ഡോക്യുമെന്റ് അപേക്ഷ\n(ഭാഷ മാറ്റത്തിന് /LANG)`;
                await sendMessage(From, greetMal);
            } else {
                await sendMessage(From, `${BOT_NAME}: Invalid input. Please type 'hi' to start and then choose:\n1️⃣ English\n2️⃣ Malayalam`);
            }
            return res.status(200).end();
        }

        // STEP 2: OPTION SELECTION (if language is set but option not yet selected)
        if (!user.lastOption) {
            if (Body.trim() === "1") {
                user.lastOption = "chat";
                await user.save();
                const msg = user.language === "malayalam" ?
                    `${BOT_NAME}: ചാറ്റ് മോഡ് സജീവമാക്കി. എന്തെങ്കിലും ടൈപ്പ് ചെയ്യുക. മെയിൻ മെനുവിലേക്ക് തിരികെ പോവാൻ 'back' അല്ലെങ്കിൽ '0' അയക്കുക.\n(ഭാഷ മാറ്റത്തിന് /LANG)` :
                    `${BOT_NAME}: Chat mode activated. Type anything to chat. Send 'back' or '0' to return to the main menu.\n(To change language, send /LANG)`;
                await sendMessage(From, msg);
            } else if (Body.trim() === "2") {
                user.lastOption = "apply";
                await user.save();
                const msg = user.language === "malayalam" ?
                    `${BOT_NAME}: ഡോക്യുമെന്റ് അപേക്ഷ സവിശേഷത വികസനഘട്ടത്തിലാണ്.\n(ഭാഷ മാറ്റത്തിന് /LANG)` :
                    `${BOT_NAME}: Apply for document feature is under development.\n(To change language, send /LANG)`;
                await sendMessage(From, msg);
            } else {
                const invalidMsg = user.language === "malayalam" ?
                    `${BOT_NAME}: അസാധുവായ ഓപ്ഷൻ. ദയവായി വീണ്ടും 'hi' അയയ്ക്കുക.` :
                    `${BOT_NAME}: Invalid option. Type 'hi' to restart.`;
                await sendMessage(From, invalidMsg);
            }
            return res.status(200).end();
        }

        // STEP 3: PROCESS CHAT MODE
        if (user.lastOption === "chat") {
            let userMessage = Body;
            // If language is malayalam, translate incoming message to English
            if (user.language === "malayalam") {
                userMessage = await translateText(Body, "MAL-ENG");
            }

            // Call the external chat API with the (possibly translated) message
            let chatResponse;
            try {
                const response = await axios.post(`${CHAT_API_BASE}/generate`, { query: userMessage });
                if (response.data && response.data.response) {
                    chatResponse = response.data.response;
                } else {
                    chatResponse = user.language === "malayalam" ?
                        "ക്ഷമിക്കണം, ഞാൻ അതിനെ പ്രോസസ് ചെയ്യാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക." :
                        "Sorry, I couldn't process that. Try again.";
                }
            } catch (apiError) {
                console.error("Error calling chat API:", apiError);
                chatResponse = user.language === "malayalam" ?
                    "ചാറ്റ് സേവനത്തിലേക്ക് കണക്റ്റ് ചെയ്യുന്നതിൽ പിഴവുണ്ടായി. ദയവായി പിന്നീട് ശ്രമിക്കുക." :
                    "Error connecting to the chat service. Please try again later.";
            }

            // If user language is malayalam, translate the response back to Malayalam
            if (user.language === "malayalam") {
                chatResponse = await translateText(chatResponse, "ENG-MAL");
            }

            await sendMessage(From, `${BOT_NAME}: ${chatResponse}`);
        }

        // (Additional processing for "apply" mode can be added here if needed)
        return res.status(200).end();
    } catch (error) {
        console.error("Error handling message:", error);
        return res.status(500).end();
    }
};

// Handler for Twilio Status Callback
const handleStatusCallback = async (req, res) => {
    const { MessageSid, MessageStatus, To, From } = req.body;
    console.log(`Status update for MessageSid ${MessageSid}: ${MessageStatus}`);
    // Optionally update your DB or log status updates here
    return res.status(200).end();
};

module.exports = { handleMessage, handleStatusCallback };
