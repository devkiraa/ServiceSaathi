const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  documentType: { 
    type: String, 
    required: true 
  },
  centreId: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['pending', 'started', 'submitted', 'approved', 'rejected', 'completed'], 
    default: 'pending' 
  },
  requiredDocuments: [{
    name: { 
      type: String, 
      required: true 
    },
    uploadedFile: { 
      type: String, 
      default: "" 
    }
  }],
  uploadToken: { 
    type: String 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
