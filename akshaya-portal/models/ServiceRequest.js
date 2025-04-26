// models/ServiceRequest.js
const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  documentType: { type: String, required: true },
  centreId:    { type: String, required: true },
  mobileNumber:{ type: String, required: true },
  status: {
    type: String,
    enum: ['documents-uploading','pending','started','submitted','approved','rejected','completed','reupload_required'],
    default: 'pending'
  },
  requiredDocuments: [{
    name:         { type: String, required: true },
    uploadedFile: { type: String, default: "" },
    fileData:     { type: String, default: "" },
    needsReupload:{ type: Boolean, default: false },
    extractionDone: { type: Boolean, default: false },
    extractedFields: { // <-- ADDED FIELD
      type: mongoose.Schema.Types.Mixed, // Allows storing flexible key-value pairs from API
      default: {}
  }
  }],
  uploadToken: { type: String },
  createdAt:   { type: Date, default: Date.now }
});

module.exports = mongoose.models.ServiceRequest 
  || mongoose.model('ServiceRequest', serviceRequestSchema);
