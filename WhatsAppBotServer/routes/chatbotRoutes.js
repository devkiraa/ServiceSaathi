// routes/chatbotRoutes.js
module.exports = function(chatbotController) {
    const express = require('express');
    const router = express.Router();
  
    // Inbound WhatsApp messages
    router.post('/webhook', chatbotController.handleMessage);
  
    // Twilio delivery/status callbacks
    router.post('/webhook/status', chatbotController.handleStatusCallback);
  
    return router;
  };
  