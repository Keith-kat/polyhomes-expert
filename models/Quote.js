const mongoose = require('mongoose');

const QuoteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  windowCount: { type: Number, required: true },
  measurements: [{ width: Number, height: Number }],
  material: { type: String, enum: ['fiberglass', 'polyester', 'stainless'], required: true },
  type: { type: String, enum: ['fixed', 'sliding', 'retractable', 'pleated', 'magnetic', 'velcro'], required: true },
  location: { type: String, required: true },
  warranty: { type: String, enum: ['basic', 'standard', 'premium'], required: true },
  totalArea: { type: Number, required: true },
  baseCost: { type: Number, required: true },
  warrantyCost: { type: Number, required: true },
  totalCost: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'completed'], default: 'pending' },
  paymentStatus: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  paymentDetails: { type: Object },
  validUntil: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quote', QuoteSchema);