const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
// Yahan aap apna MongoDB Atlas ka URL dalenge baad mein
const mongoURI = process.env.MONGO_URI || 'https://acrylic.onrender.com';
mongoose.connect(mongoURI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ DB Connection Error:', err));

// Order Schema (Data Structure)
const orderSchema = new mongoose.Schema({
    items: Array,
    total: String,
    customerEmail: String,
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// Contact Inquiry Schema
const inquirySchema = new mongoose.Schema({
    name: String,
    email: String,
    service: String,
    message: String,
    date: { type: Date, default: Date.now }
});
const Inquiry = mongoose.model('Inquiry', inquirySchema);

// --- ROUTES ---

// 1. Save Checkout Order
app.post('/api/orders', async (req, res) => {
    try {
        const newOrder = new Order(req.body);
        await newOrder.save();
        res.status(201).json({ success: true, message: "Order stored successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Save Contact Inquiry
app.post('/api/inquiry', async (req, res) => {
    try {
        const newInquiry = new Inquiry(req.body);
        await newInquiry.save();
        res.status(201).json({ success: true, message: "Inquiry received!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
