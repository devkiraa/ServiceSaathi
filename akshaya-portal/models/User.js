// models/user.js
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username:   { type: String, required: true, unique: true, trim: true },
  phone:      { type: String, required: true },
  email:      { type: String, required: true },
  shopName:   { type: String, required: true },
  personName: { type: String, required: true },
  password:   { type: String, required: true, minlength: 6 },
  role:       { type: String, enum: ['user','admin'], default: 'user' },
  type:       { type: String, enum: ['CSC','Akshaya'], required: true },
  centerId:   { type: String },
  district:   { type: String, required: true },
  subdistrict:{ type: String, required: true },   // ← newly added
  services: {
    type: Map, // Allows dynamic keys
    of: Boolean, // Values will be booleans (true/false)
  },
  address: {
    buildingName: { type: String, default: null },
    street:       { type: String, default: null },
    locality:     { type: String, default: null },
    pincode:      { type: Number, default: null }
  }
}, {
  collection: 'user'
});

// Hash password
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Avoid OverwriteModelError
module.exports = mongoose.models.User || mongoose.model('User', userSchema);
