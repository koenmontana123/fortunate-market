const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// Database Connection
mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/fortune_bank")
    .then(() => console.log("✅ Bank DB Connected"))
    .catch(err => console.log(err));

// --- M-PESA LOGIC (Integrated from GitHub Template) ---
const getAccessToken = async () => {
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString("base64");
    try {
        const { data } = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
            headers: { Authorization: `Basic ${auth}` }
        });
        return data.access_token;
    } catch (err) {
        console.error("Token Error:", err.response.data);
    }
};

app.post("/api/mpesa/stkpush", async (req, res) => {
    const { phone, amount } = req.body;
    const token = await getAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, -3);
    const password = Buffer.from(process.env.MPESA_SHORTCODE + process.env.MPESA_PASSKEY + timestamp).toString("base64");

    try {
        const { data } = await axios.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
            BusinessShortCode: process.env.MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone,
            PartyB: process.env.MPESA_SHORTCODE,
            PhoneNumber: phone,
            CallBackURL: "https://your-render-url.onrender.com/api/mpesa/callback",
            AccountReference: "FortuneBank",
            TransactionDesc: "Deposit to Account"
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json({ message: "Check your phone for the M-Pesa PIN prompt!", data });
    } catch (err) {
        res.status(500).json({ error: "STK Push Failed", details: err.response.data });
    }
});

// Serve Frontend
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Fortune Bank live on port ${PORT}`));
