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
    enum: ['csc', 'akshaya'],
    required: true
  },
  // Centre ID as entered by the user (may be an identifier)
  centerId: { 
    type: String 
  },
  district: {
    type:String,
    required:true
  }
});

// Hash the password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
