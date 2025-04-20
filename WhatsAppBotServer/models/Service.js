// models/Service.js
const mongoose = require('mongoose');

const ServiceSchema = new mongoose.Schema({
  // unique slug or key for the service, e.g. 'income_certificate'
  key: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  // human‑readable name, e.g. 'Income Certificate'
  name: {
    type: String,
    required: true,
    trim: true
  },
  // list of documents users must upload
  requiredDocuments: [
    {
      name: { type: String, required: true },
    }
  ]
});

module.exports = mongoose.model('Service', ServiceSchema);
