const client = require('../config/twilio');
const User = require('../models/user');

const handleMessage = async (req, res) => {
    const { Body, From } = req.body;
    const userInput = Body.trim().toLowerCase();

    let responseMessage;

    if (userInput === "hi") {
        responseMessage = "Welcome to Akshaya Centre!\nPlease select an option:\n1️⃣ Chat\n2️⃣ Apply for Document";
        await updateUserOption(From, null); // Reset last option
    } else if (userInput === "1" || userInput.includes("chat")) {
        responseMessage = "You selected Chat. Please type your query.";
        await updateUserOption(From, "chat");
    } else if (userInput === "2" || userInput.includes("apply")) {
        responseMessage = "You selected Apply for Document. Please enter the document name.";
        await updateUserOption(From, "apply");
    } else {
        const lastOption = await getUserLastOption(From);

        if (lastOption === "chat") {
            responseMessage = `You asked: "${Body}".\nI'll get back with relevant information soon.`;
        } else if (lastOption === "apply") {
            responseMessage = `You are applying for: "${Body}".\nProcessing your request...`;
        } else {
            responseMessage = "Invalid input. Please type 'hi' to restart.";
        }
    }

    await sendMessage(From, responseMessage);
    res.sendStatus(200);
};

// Function to send a message
const sendMessage = async (to, message) => {
    await client.messages.create({
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
        to,
        body: message
    });
};

// Function to update user last option
const updateUserOption = async (phone, option) => {
    await User.findOneAndUpdate(
        { phoneNumber: phone },
        { lastOption: option },
        { upsert: true, new: true }
    );
};

// Function to get last selected option
const getUserLastOption = async (phone) => {
    const user = await User.findOne({ phoneNumber: phone });
    return user ? user.lastOption : null;
};

module.exports = { handleMessage };