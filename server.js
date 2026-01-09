const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // Password secure karne ke liye
const jwt = require('jsonwebtoken'); // Login session ke liye
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Payment ke liye
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ DB Connection Error:', err));

// --- SCHEMAS ---

// 1. User Schema (For Login/Signup)
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// 2. Order Schema
const orderSchema = new mongoose.Schema({
    items: Array,
    total: String,
    customerEmail: String,
    status: { type: String, default: 'Pending' },
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// --- ROUTES ---

// 1. AUTH: Register/Login (Combined Logic)
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        
        // Agar user nahi hai, toh register karlo (Simple UX)
        if (!user) {
            const hashedPassword = await bcrypt.hash(password, 10);
            user = new User({ email, password: hashedPassword });
            await user.save();
        } else {
            // Agar user hai, toh password check karo
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ message: "Invalid Password" });
        }

        const token = jwt.sign({ id: user._id }, 'SECRET_KEY_123', { expiresIn: '1h' });
        res.status(200).json({ success: true, token, email: user.email });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. PAYMENT: Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { items, email } = req.body;

        const line_items = items.map(item => ({
            price_data: {
                currency: 'gbp',
                product_data: { name: item.name },
                unit_amount: item.price * 100, // Stripe takes amount in pence
            },
            quantity: 1,
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            customer_email: email,
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/success.html`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:5500'}/cancel.html`,
        });

        // Order ko DB mein save karein (as pending)
        const newOrder = new Order({ items, total: "£" + (line_items.reduce((a,b) => a + b.price_data.unit_amount, 0)/100), customerEmail: email });
        await newOrder.save();

        res.json({ url: session.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. INQUIRY: Contact Form
app.post('/api/inquiry', async (req, res) => {
    try {
        const newInquiry = new mongoose.Schema({ name: String, email: String, message: String });
        // Aapka purana inquiry logic yahan kaam karega
        res.status(201).json({ success: true, message: "Inquiry received!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Professional Server running on port ${PORT}`));
