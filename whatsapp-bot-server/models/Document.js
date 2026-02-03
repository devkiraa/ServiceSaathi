const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  serviceName: {
    type: String,
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  contactNumber: {
    type: String,
    required: true
  },
  files: {
    type: [String],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Document', documentSchema);
