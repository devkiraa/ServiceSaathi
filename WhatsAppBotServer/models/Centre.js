const mongoose = require('mongoose');

const centreSchema = new mongoose.Schema({
  // Shop name is used as the centre name
  centreName: { 
    type: String, 
    required: true 
  },
  // Person name for the centre owner
  ownerName: { 
    type: String, 
    required: true 
  },
  // Contact mobile number
  contact: { 
    type: String, 
    required: true 
  },
  // Email address provided during signup
  email: { 
    type: String, 
    required: true 
  },
  // Centre type: CSC or Akshaya
  type: { 
    type: String, 
    enum: ['csc', 'akshaya'], 
    required: true 
  },
  // Centre ID provided during signup
  centerId: { 
    type: String 
  },
  // Approval status – user cannot login until this is approved
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('Centre', centreSchema);
