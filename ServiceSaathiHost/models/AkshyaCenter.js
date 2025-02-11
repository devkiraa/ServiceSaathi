const mongoose = require('mongoose');

const akshyaCenterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  district: {
    type: String,
    required: true,
  },
  subdistrict: {
    type: String,
    required: true,
  },
  services: [
    {
      serviceName: String,
      requiredDocuments: [String],
    },
  ],
});

module.exports = mongoose.model('AkshyaCenter', akshyaCenterSchema);