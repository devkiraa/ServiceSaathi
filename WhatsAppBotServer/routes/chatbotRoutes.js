const express = require('express');
const { handleMessage } = require('../controllers/chatbotController');
const router = express.Router();

router.post('/webhook', handleMessage);

module.exports = router;