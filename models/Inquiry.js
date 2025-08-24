const mongoose = require('mongoose');

const InquirySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  inquiryType: { type: String, enum: ['general', 'quote', 'technical', 'complaint'], required: true },
  message: { type: String },
  status: { type: String, enum: ['new', 'in-progress', 'resolved'], default: 'new' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Inquiry', InquirySchema);