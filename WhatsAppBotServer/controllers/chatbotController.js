// controllers/chatbotController.js
const Chat   = require('../models/chat');
const User   = require('../models/wha-user');
const client = require('../config/twilio');
const axios  = require('axios');

module.exports = function({ CHAT_API_BASE }) {
  //
  // ─── HELPERS ────────────────────────────────────────────────────────────────
  //
  const storeChatMessage = async (userPhone, message, direction) => {
    try {
      await Chat.create({ userPhone, message, direction });
    } catch (err) {
      console.error("Error storing chat:", err);
    }
  };

  const sendMessage = async (to, body) => {
    try {
      if (!to.startsWith("whatsapp:")) to = `whatsapp:${to}`;
      await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to,
        body
      });
      await storeChatMessage(to.replace("whatsapp:", ""), body, 'outbound');
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  //
  // ─── LOAD MODULES ───────────────────────────────────────────────────────────
  //
  const languageModule = require('./modules/languageModule')(sendMessage);
  // Pass applyModule into optionModule so "2️⃣ Apply" triggers the flow
  const applyModule   = require('./modules/applyModule')(sendMessage, CHAT_API_BASE);
  const optionModule  = require('./modules/optionModule')(sendMessage, applyModule);
  const chatModule    = require('./modules/chatModule')(sendMessage, CHAT_API_BASE);

  //
  // ─── HANDLER: Inbound user messages ─────────────────────────────────────────
  //
  const handleMessage = async (req, res) => {
    const Body      = (req.body.Body || "").trim();
    const From      = (req.body.From || "").trim();
    const userPhone = From.replace(/^whatsapp:/i, "");

    if (!Body || Body.toLowerCase() === "ok") {
      return res.sendStatus(200);
    }
    await storeChatMessage(userPhone, Body, 'inbound');

    // Load or create chat‑bot user
    let user = await User.findOne({ phoneNumber: userPhone });
    if (!user) {
      user = new User({ phoneNumber: userPhone, lastOption: null, language: null });
      await user.save();
    }

    const lower = Body.toLowerCase();

    // /LANG → reset
    if (lower === "/lang") {
      user.language   = null;
      user.lastOption = null;
      await user.save();
      await languageModule.prompt(From);
      return res.sendStatus(200);
    }

    // back/0 → main menu
    if (user.lastOption && (lower === "back" || lower === "0")) {
      user.lastOption = null;
      await user.save();
      await optionModule.prompt(user, From);
      return res.sendStatus(200);
    }

    // hi → always show menu
    if (lower === "hi") {
      user.lastOption = null;
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
      await languageModule.choose(Body, user, From);
      return res.sendStatus(200);
    }

    // STEP 2: option selection
    if (!user.lastOption) {
      await optionModule.choose(Body, user, From);
      return res.sendStatus(200);
    }

    // STEP 3: chat vs apply
    if (user.lastOption === "chat") {
      await chatModule.process(Body, user, From);
      return res.sendStatus(200);
    }
    if (user.lastOption === "apply") {
      await applyModule.process(Body, user, From);
      return res.sendStatus(200);
    }

    // fallback
    await sendMessage(From, "*Invalid option.* Type 'hi' to restart.");
    return res.sendStatus(200);
  };

  //
  // ─── HANDLER: Delivery status callbacks ─────────────────────────────────────
  //
  const handleStatusCallback = (req, res) => res.sendStatus(200);

  return { handleMessage, handleStatusCallback };
};
