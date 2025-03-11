const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    userPhone: { type: String, required: true },
    message: { type: String, required: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chat', ChatSchema);
