const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['admin', 'employee'], required: true },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });

userSchema.methods.verifyPassword = function(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function(plain) {
  return bcrypt.hash(plain, 10);
};

module.exports = mongoose.model('User', userSchema);
