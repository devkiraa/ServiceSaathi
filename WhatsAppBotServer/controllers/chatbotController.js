// controllers/chatbotController.js
const User   = require('../models/user');
const Chat   = require('../models/chat');
const client = require('../config/twilio');
const axios  = require('axios');

module.exports = function({ CHAT_API_BASE, TRANSLATE_API_BASE }) {
  // Persist chats
  const storeChatMessage = async (userPhone, message, direction) => {
    try {
      await Chat.create({ userPhone, message, direction });
    } catch (err) {
      console.error("Error storing chat:", err);
    }
  };

  // Translate via external API
  const translateText = async (text, mode) => {
    try {
      const res = await axios.post(`${TRANSLATE_API_BASE}/translate`, { text, mode });
      return res.data?.response || text;
    } catch (err) {
      console.error("Translation error:", err);
      return text;
    }
  };

  // Send WhatsApp message & store outbound
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

  // Inbound user messages
  const handleMessage = async (req, res) => {
    const Body = (req.body.Body || "").trim();
    const From = (req.body.From || "").trim();
    const userPhone = From.replace(/^whatsapp:/i, "");

    // Ignore blank or “ok”
    if (!Body || Body.toLowerCase() === "ok") return res.sendStatus(200);

    await storeChatMessage(userPhone, Body, 'inbound');
    let user = await User.findOne({ phoneNumber: userPhone });
    if (!user) {
      user = new User({ phoneNumber: userPhone, lastOption: null, language: null });
      await user.save();
    }
    const lower = Body.toLowerCase();

    // /LANG → reset
    if (lower === "/lang") {
      user.language = null;
      user.lastOption = null;
      await user.save();
      await sendMessage(From,
        "*Language reset.*\nPlease choose your language:\n1️⃣ English\n2️⃣ Malayalam"
      );
      return res.sendStatus(200);
    }

    // back or 0 → main menu
    if (user.lastOption && (lower === "back" || lower === "0")) {
      user.lastOption = null;
      await user.save();
      const menu = user.language === "malayalam"
        ? "*പ്രധാന മെനുവിലേക്ക് തിരികെ പോവുന്നു.*\n1️⃣ ചാറ്റ്\n2️⃣ ഡോക്യുമെന്റ് അപേക്ഷ"
        : "*Returning to main menu.*\n1️⃣ Chat\n2️⃣ Apply for Document";
      await sendMessage(From, menu);
      return res.sendStatus(200);
    }

    // hi always resets into menu
    if (lower === "hi") {
      user.lastOption = null;
      await user.save();
      if (!user.language) {
        await sendMessage(From,
          "*✨ Welcome to SERVICE SAATHI - Akshaya Centre! ✨*\n" +
          "Please choose your language:\n1️⃣ English\n2️⃣ Malayalam\n" +
          "_(Change language anytime with /LANG)_"
        );
      } else {
        const opts = user.language === "malayalam"
          ? "*ദയവായി തിരഞ്ഞെടുക്കുക:*\n1️⃣ ചാറ്റ്\n2️⃣ ഡോക്യുമെന്റ് അപേക്ഷ\n(ഭാഷ മാറ്റത്തിന് /LANG)"
          : "*Please choose an option:*\n1️⃣ Chat\n2️⃣ Apply for Document\n(To change language, send /LANG)";
        await sendMessage(From, opts);
      }
      return res.sendStatus(200);
    }

    // STEP 1: language selection
    if (!user.language) {
      if (Body === "1") {
        user.language = "english";
        await user.save();
        await sendMessage(From,
          "*Hello!* Please choose:\n1️⃣ Chat\n2️⃣ Apply for Document\n" +
          "_(Change language with /LANG)_"
        );
      } else if (Body === "2") {
        user.language = "malayalam";
        await user.save();
        await sendMessage(From,
          "*ഹലോ!* ദയവായി തിരഞ്ഞെടുക്കുക:\n1️⃣ ചാറ്റ്\n2️⃣ ഡോക്യുമെന്റ് അപേക്ഷ\n" +
          "_(ഭാഷ മാറ്റത്തിന് /LANG)_"
        );
      } else {
        await sendMessage(From,
          "*Invalid input.* Please type 'hi' to start and then choose:\n1️⃣ English\n2️⃣ Malayalam"
        );
      }
      return res.sendStatus(200);
    }

    // STEP 2: option selection
    if (!user.lastOption) {
      if (Body === "1") {
        user.lastOption = "chat";
        await user.save();
        const msg = user.language === "malayalam"
          ? "*ചാറ്റ് മോഡ് സജീവമാക്കി.* ടൈപ്പ് ചെയ്യുക. മെയിൻ മെനുവിലേക്ക് 'back' അല്ലെങ്കിൽ '0'."
          : "*Chat mode activated.* Type anything. Return to menu with 'back' or '0'.";
        await sendMessage(From, msg);
      } else if (Body === "2") {
        user.lastOption = "apply";
        await user.save();
        const msg = user.language === "malayalam"
          ? "*ഡോക്യുമെന്റ് അപേക്ഷ ഡെവലപ്‌മെന്റ് ഘട്ടത്തിലാണ്.*"
          : "*Apply for document feature is under development.*";
        await sendMessage(From, msg);
      } else {
        const inv = user.language === "malayalam"
          ? "*അസാധുവായ ഓപ്ഷൻ.* 'hi' ടൈപ്പ് ചെയ്ത് വീണ്ടും ആരംഭിക്കുക."
          : "*Invalid option.* Type 'hi' to restart.";
        await sendMessage(From, inv);
      }
      return res.sendStatus(200);
    }

    // STEP 3: chat mode
    if (user.lastOption === "chat") {
      let userMsg = Body;
      if (user.language === "malayalam") {
        userMsg = await translateText(Body, "MAL-ENG");
      }
      let reply;
      try {
        const apiRes = await axios.post(`${CHAT_API_BASE}/generate`, { query: userMsg });
        reply = apiRes.data?.response;
      } catch (e) {
        console.error("Chat API error:", e);
      }
      if (!reply) {
        reply = user.language === "malayalam"
          ? "ക്ഷമിക്കണം, പ്രശ്നം വന്നിരിക്കുന്നു. വീണ്ടും ശ്രമിക്കുക."
          : "Sorry, something went wrong. Please try again.";
      }
      if (user.language === "malayalam") {
        reply = await translateText(reply, "ENG-MAL");
      }
      await sendMessage(From, reply);
      return res.sendStatus(200);
    }

    // fallback
    await sendMessage(From, "*Invalid option.* Type 'hi' to restart.");
    return res.sendStatus(200);
  };

  // Delivery status callbacks
  const handleStatusCallback = (req, res) => {
    return res.sendStatus(200);
  };

  return { handleMessage, handleStatusCallback };
};
