// models/wha-user.js
const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  district:       { type: String, required: true },
  subdistrict:    { type: String, required: true },
  centreId:       { type: String, required: true },
  documentType:   { type: String, required: true }, // e.g. "income_certificate"
  documentName:   { type: String, required: true }, // e.g. "Income Certificate"
  serviceRequestId:{ type: String, default: null },
  requiredDocuments:[{
    name:        { type: String, required: true },
    uploadedFile:{ type: String, default: "" }
  }],
  uploadLink:     { type: String, default: null },
  createdAt:      { type: Date,   default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  phoneNumber:  { type: String, required: true, unique: true },
  lastOption:   { type: String, default: null },
  language:     { type: String, default: null },
  // track in‑progress flow
  applyState:   { type: String, enum: ['district','subdistrict','document','centre', null], default: null },
  applyDataTemp:{
    district:    String,
    subdistrict: String,
    documentType:String,
    documentName:String,
    centres:     [{ centreId: String, centreName: String }]
  },
  // all completed applications
  applications: [applicationSchema]
}, {
  collection: 'wha-user'
});

// Avoid OverwriteModelError
module.exports = mongoose.models['wha-user'] 
  || mongoose.model('wha-user', userSchema);
