const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
  phone: { type: String, match: /^\+?254\d{9}$/ },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);