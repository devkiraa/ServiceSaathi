// controllers/helpers/messageHelper.js
const Chat = require('../../models/chat');
const client = require('../../config/twilio');

async function storeChatMessage(userPhone, message, direction) {
  try {
    await Chat.create({ userPhone, message, direction });
  } catch (err) {
    console.error("Error storing chat:", err);
  }
}

async function sendMessage(to, body) {
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
}

module.exports = { storeChatMessage, sendMessage };
