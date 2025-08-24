const mongoose = require('mongoose');
const ProductSchema = new mongoose.Schema({
  type: { type: String, enum: ['fixed', 'sliding', 'retractable', 'pleated', 'magnetic', 'velcro'], required: true },
  material: { type: String, enum: ['fiberglass', 'polyester', 'stainless'], required: true },
  pricePerM2: { type: Number, required: true },
  image: { type: String },
  description: { type: String },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Product', ProductSchema);