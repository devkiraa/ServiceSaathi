const mongoose = require('mongoose');

const serviceApplicationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Reference to the User model
  },
  akshyaCenterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AkshyaCenter', // Reference to the AkshyaCenter model
  },
  serviceName: {
    type: String,
    required: true,
  },
  requiredDocuments: [
    {
      documentName: String,
      filePath: String,
      uploadedAt: Date,
    },
  ],
  paymentScreenshot: String,
  status: {
    type: String,
    enum: ['Pending', 'Verified', 'Completed'],
    default: 'Pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ServiceApplication', serviceApplicationSchema);