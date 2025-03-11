const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    lastOption: { type: String, default: null }, // e.g., "chat", "apply"
    language: { type: String, default: null }    // "english" or "malayalam"
}, { collection: 'user' });

module.exports = mongoose.model('User', UserSchema, 'user');
