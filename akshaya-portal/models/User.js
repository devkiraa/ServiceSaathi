const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Mobile number is used as the username for login
  username: { 
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // Storing mobile number (same as username)
  phone: { 
    type: String,
    required: true
  },
  // Additional signup details
  email: { 
    type: String, 
    required: true 
  },
  shopName: { 
    type: String, 
    required: true 
  },
  personName: { 
    type: String, 
    required: true 
  },
  password: { 
    type: String, 
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  // Centre type: either CSC or Akshaya
  type: { 
    type: String,
    enum: ['CSC', 'Akshaya'],
    required: true
  },
  // Centre ID as entered by the user (may be an identifier)
  centerId: { 
    type: String 
  },
  district: {
    type:String,
    required:true
  },
  services:{
    income_certificate: Boolean,
    voter_registration: Boolean,
    passport_service: Boolean,
    utility_payments: Boolean,
    possession_certificate: Boolean
  },
  address: {
    buildingName: { type: String, default: null },
    street: { type: String, default: null },
    locality: { type: String, default:null},
    pincode: { type: Number, default: null }
      
}});

// Hash the password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
