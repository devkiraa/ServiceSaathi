// models/Centre.js
const mongoose = require('mongoose');

const centreSchema = new mongoose.Schema({
  centreName:  { type: String, required: true },
  ownerName:   { type: String, required: true },
  contact:     { type: String, required: true },
  email:       { type: String, required: true },
  type:        { type: String, enum: ['csc','akshaya'], required: true },
  centerId:    { type: String },
  status:      { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  district:    { type: String, required: true },   // ← newly added
  subdistrict: { type: String, required: true },   // ← newly added
  services: {
    type: Map, // Allows dynamic keys
    of: Boolean, // Values will be booleans (true/false)
  },
  createdAt:   { type: Date, default: Date.now }
});

// Avoid OverwriteModelError
module.exports = mongoose.models.Centre 
  || mongoose.model('Centre', centreSchema);
