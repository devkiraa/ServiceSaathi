const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    phoneNumber: { type: String, required: true, unique: true },
    lastOption: { type: String, default: null }, // Stores last selected option
});

module.exports = mongoose.model('User', UserSchema);
