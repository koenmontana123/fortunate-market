const mongoose = require('mongoose');
const Product = require('./models/Product');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

const startAdding = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to The Fortunate Market Database...');

        const name = await askQuestion('Product Name: ');
        const price = await askQuestion('Price (KES): ');
        const description = await askQuestion('Description: ');
        const category = await askQuestion('Category: ');
        const image = await askQuestion('Image URL: ');
        const fortuneScore = await askQuestion('Fortune Score (1-100): ');
        const stock = await askQuestion('Quantity in Stock: ');

        const newProduct = new Product({
            name,
            price: Number(price),
            description,
            category,
            image,
            fortuneScore: Number(fortuneScore),
            stock: Number(stock)
        });

        await newProduct.save();
        console.log('? Success! Product added to the market.');
        
        rl.close();
        process.exit();
    } catch (err) {
        console.error('? Error:', err);
        process.exit(1);
    }
};

startAdding();
