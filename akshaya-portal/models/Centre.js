const mongoose = require('mongoose');

const centreSchema = new mongoose.Schema({
  centreName: { type: String, required: true },
  ownerName: { type: String, required: true },
  contact: { type: String, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Centre', centreSchema);
