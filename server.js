const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer'); 
const app = express();
const PORT = 3000;

// Business Logic Constants
const DAILY_LIMIT = 50000; 
const SAVINGS_INTEREST_RATE = 0.000137;

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// --- DATABASE CONNECTION ---
mongoose.connect('mongodb://127.0.0.1:27017/fortune_bank')
    .then(() => console.log("✅ Fortune Bank: Connected to MongoDB Vault"))
    .catch(err => console.error("❌ Database connection failed:", err));

// --- SCHEMAS & MODELS ---
const userSchema = new mongoose.Schema({
    name: String,
    accountNumber: { type: String, unique: true, required: true },
    pin: String, 
    securityQuestion: String,
    securityAnswer: String, 
    failedAttempts: { type: Number, default: 0 },
    isLocked: { type: Boolean, default: false },
    balance: { type: Number, default: 5000 },
    savingsJar: { type: Number, default: 0 },
    lastInterestApplied: { type: Date, default: Date.now }
});

const transactionSchema = new mongoose.Schema({
    type: String, 
    fromAcc: String,
    toTarget: String, 
    amount: Number,
    reference: String,
    savingsGenerated: { type: Number, default: 0 },
    date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);

// --- SUPPORT EMAIL CONFIGURATION ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your.fortune.bank.email@gmail.com', 
        pass: 'your-app-password-here' 
    }
});

// --- PRIMARY ROUTES ---

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/register', async (req, res) => {
    const { name, accountNumber, pin, securityQuestion, securityAnswer } = req.body;
    const cleanAcc = accountNumber.trim().toUpperCase();

    try {
        const checkExisting = await User.findOne({ accountNumber: cleanAcc });
        if (checkExisting) return res.status(400).json({ message: "Account already registered!" });

        const hashedPin = await bcrypt.hash(pin, 10);
        const hashedAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), 10);

        const newUser = await User.create({ 
            name, 
            accountNumber: cleanAcc, 
            pin: hashedPin,
            securityQuestion,
            securityAnswer: hashedAnswer,
            balance: 5000 
        });
        res.json({ message: "Registration successful", userId: newUser._id });
    } catch (err) {
        res.status(500).json({ message: "Error securing new account" });
    }
});

app.post('/login', async (req, res) => {
    const { accountNumber, pin } = req.body;
    const cleanAcc = accountNumber.trim().toUpperCase();
    const user = await User.findOne({ accountNumber: cleanAcc });

    if (!user) return res.status(401).json({ message: "Account not found" });
    if (user.isLocked) return res.status(403).json({ message: "Account locked. Use recovery to reset." });

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (isMatch) {
        user.failedAttempts = 0;
        await user.save();
        res.json({ message: "Login Successful", userId: user._id });
    } else {
        user.failedAttempts += 1;
        if (user.failedAttempts >= 3) user.isLocked = true;
        await user.save();
        res.status(401).json({ message: `Invalid PIN. Attempts left: ${3 - user.failedAttempts}` });
    }
});

// --- FIXED RECOVERY ROUTES ---

app.post('/recovery/get-question', async (req, res) => {
    try {
        const { accountNumber } = req.body;
        const user = await User.findOne({ accountNumber: accountNumber.toUpperCase() });
        if (user) {
            res.json({ question: user.securityQuestion });
        } else {
            res.status(404).json({ message: "Account number not found" });
        }
    } catch (err) {
        res.status(500).json({ message: "Server error during recovery" });
    }
});

app.post('/recovery/reset-pin', async (req, res) => {
    try {
        const { accountNumber, answer, newPin } = req.body;
        const user = await User.findOne({ accountNumber: accountNumber.toUpperCase() });

        if (!user) return res.status(404).json({ message: "Account not found" });

        // Compare hashed security answer
        const isMatch = await bcrypt.compare(answer.toLowerCase().trim(), user.securityAnswer);

        if (isMatch) {
            user.pin = await bcrypt.hash(newPin, 10);
            user.failedAttempts = 0;
            user.isLocked = false;
            await user.save();
            res.json({ message: "PIN reset successful! You can now log in." });
        } else {
            res.status(401).json({ message: "Incorrect security answer." });
        }
    } catch (err) {
        res.status(500).json({ message: "Error resetting PIN" });
    }
});

// --- SUPPORT ROUTE ---
app.post('/contact-support', async (req, res) => {
    const { userId, message } = req.body;
    try {
        const user = await User.findById(userId);
        const mailOptions = {
            from: 'fortune.bank.support@gmail.com',
            to: 'your.personal.email@gmail.com', 
            subject: `SUPPORT TICKET: ${user.name} (${user.accountNumber})`,
            text: `Client Message: ${message}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) return res.status(500).json({ message: "Email server error" });
            res.json({ message: "Support ticket sent successfully!" });
        });
    } catch (err) {
        res.status(500).json({ message: "Could not find user details" });
    }
});

// --- BANKING & HISTORY ROUTES ---

app.get('/balance/:id', async (req, res) => {
    const user = await User.findById(req.params.id);
    res.json(user);
});

app.post('/transfer', async (req, res) => {
    const { fromId, toAccount, amount } = req.body;
    const numAmount = Number(amount);
    const sender = await User.findById(fromId);
    const receiver = await User.findOne({ accountNumber: toAccount.toUpperCase() });

    if (sender && receiver && sender.balance >= numAmount) {
        const savingsAmount = numAmount * 0.01;
        sender.balance -= numAmount;
        sender.savingsJar += savingsAmount;
        receiver.balance += (numAmount - savingsAmount);

        await sender.save();
        await receiver.save();
        
        await Transaction.create({
            type: 'Transfer',
            fromAcc: sender.accountNumber,
            toTarget: receiver.accountNumber,
            amount: numAmount,
            savingsGenerated: savingsAmount
        });
        res.json({ message: "Transfer Complete" });
    } else {
        res.status(400).json({ message: "Transfer failed" });
    }
});

app.get('/history', async (req, res) => {
    const history = await Transaction.find().sort({ date: -1 }).limit(20);
    res.json(history);
});

app.listen(PORT, () => console.log(`Fortune Bank live on http://localhost:${PORT}`));