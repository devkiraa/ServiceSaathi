// models/ServiceRequest.js
const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  documentType: { type: String, required: true },
  centreId: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'started', 'submitted', 'approved', 'rejected'], 
    default: 'pending' 
  },
  requiredDocuments: [{
    name: String,
    uploadedFile: { type: String, default: "" }
  }],
  uploadToken: { type: String }, // New field to generate the upload link
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
