const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    description: String,
    category: String,
    image: String,
    fortuneScore: { type: Number, default: 0 },
    stock: { type: Number, required: true },
    isFeatured: { type: Boolean, default: false }
});

module.exports = mongoose.model('Product', ProductSchema);
