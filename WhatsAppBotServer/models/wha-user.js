const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true },
  lastOption:  { type: String, default: null },  // e.g., "chat", "apply"
  language:    { type: String, default: null }   // "english" or "malayalam"
}, {
  collection: 'wha-user'   // ← now points at the "wha-user" collection
});

// ✅ Corrected: added a comma between 'wha-user' and UserSchema
module.exports = mongoose.model('wha-user', UserSchema);
