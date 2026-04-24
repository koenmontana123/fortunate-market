const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

// --- M-PESA DARAJA CREDENTIALS ---
// Replace these with your actual keys from Safaricom Developer Portal
const consumerKey = "YOUR_CONSUMER_KEY_HERE";
const consumerSecret = "YOUR_CONSUMER_SECRET_HERE";
const shortCode = "174379"; 
const passkey = "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919";

mongoose.connect("mongodb://127.0.0.1:27017/fortune_bank");

const User = mongoose.model("User", new mongoose.Schema({
    accountNumber: String,
    balance: { type: Number, default: 0 }
}));

// --- GENERATE ACCESS TOKEN ---
const getAccessToken = async () => {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
    const res = await axios.get("https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials", {
        headers: { Authorization: `Basic ${auth}` }
    });
    return res.data.access_token;
};

// --- STK PUSH ROUTE ---
app.post("/api/mpesa/stkpush", async (req, res) => {
    const { phone, amount, accNo } = req.body;
    const token = await getAccessToken();
    const date = new Date();
    const timestamp = date.getFullYear() +
        ("0" + (date.getMonth() + 1)).slice(-2) +
        ("0" + date.getDate()).slice(-2) +
        ("0" + date.getHours()).slice(-2) +
        ("0" + date.getMinutes()).slice(-2) +
        ("0" + date.getSeconds()).slice(-2);
    
    const password = Buffer.from(shortCode + passkey + timestamp).toString("base64");

    try {
        await axios.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
            BusinessShortCode: shortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: amount,
            PartyA: phone,
            PartyB: shortCode,
            PhoneNumber: phone,
            CallBackURL: "https://your-render-url.onrender.com/callback",
            AccountReference: accNo,
            TransactionDesc: "Deposit"
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.json({ message: "STK Push sent to your phone!" });
    } catch (err) {
        res.status(500).json({ error: "M-Pesa request failed" });
    }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.listen(3000, () => console.log("Bank Server running on port 3000"));
