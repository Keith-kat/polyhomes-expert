const mongoose = require('mongoose');

const InstallationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quote: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote', required: true },
  scheduledDate: { type: Date, required: true },
  status: { type: String, enum: ['scheduled', 'in-progress', 'completed', 'cancelled'], default: 'scheduled' },
  notes: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Installation', InstallationSchema);