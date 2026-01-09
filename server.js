const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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

// 1. User Schema
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
    stripeSessionId: String,
    status: { type: String, default: 'Pending' }, // Payment confirm hone par 'Paid' ho jayega
    date: { type: Date, default: Date.now }
});
const Order = mongoose.model('Order', orderSchema);

// 3. Inquiry Schema (Fixed)
const inquirySchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    date: { type: Date, default: Date.now }
});
const Inquiry = mongoose.model('Inquiry', inquirySchema);

// --- ROUTES ---

// 1. AUTH: Combined Register/Login
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        
        if (!user) {
            // New Registration
            const hashedPassword = await bcrypt.hash(password, 10);
            user = new User({ email, password: hashedPassword });
            await user.save();
        } else {
            // Password Verification
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ success: false, message: "Invalid Password" });
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'SUPER_SECRET', { expiresIn: '24h' });
        res.status(200).json({ success: true, token, email: user.email });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. PAYMENT: Stripe Checkout (Professional Flow)
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { items, email } = req.body;

        const line_items = items.map(item => ({
            price_data: {
                currency: 'gbp',
                product_data: { name: item.name },
                unit_amount: Math.round(item.price * 100), 
            },
            quantity: 1,
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items,
            mode: 'payment',
            customer_email: email,
            success_url: `${process.env.FRONTEND_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/cancel.html`,
        });

        // Save Order as Pending
        const totalAmount = line_items.reduce((acc, curr) => acc + curr.price_data.unit_amount, 0) / 100;
        const newOrder = new Order({ 
            items, 
            total: `£${totalAmount.toFixed(2)}`, 
            customerEmail: email,
            stripeSessionId: session.id 
        });
        await newOrder.save();

        res.json({ url: session.url });
    } catch (err) {
        console.error("Stripe Error:", err);
        res.status(500).json({ error: "Could not create payment session" });
    }
});

// 3. INQUIRY: Contact Form (Fixed Logic)
app.post('/api/inquiry', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        const newInquiry = new Inquiry({ name, email, message });
        await newInquiry.save();
        res.status(201).json({ success: true, message: "Inquiry stored successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Professional Server running on port ${PORT}`));
