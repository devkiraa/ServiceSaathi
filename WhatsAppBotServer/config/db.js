const mongoose = require('mongoose');
require('dotenv').config();
const chalk = require('chalk'); // Import chalk

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ MongoDB Atlas connected to CHATBOTDB");
        console.log('\n==================================');
        console.log(`${chalk.magenta('\nLogs from Service Saathi WhatsApp Server')}`);
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
};

module.exports = connectDB;
