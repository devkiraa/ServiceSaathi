const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
app.use(bodyParser.json());

// Meta API Configuration
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

// Helper function to send messages via WhatsApp
const sendMessageToWhatsApp = async (to, message) => {
  const url = `https://graph.facebook.com/v18.0/123456789/messages`; // Replace `123456789` with your phone number ID
  const data = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message },
  };
  try {
    await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.error('Error sending WhatsApp message:', err.response ? err.response.data : err.message);
  }
};

// Webhook Verification (WhatsApp)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.status(403).send('Verification failed');
});

// Handle Incoming Messages (WhatsApp)
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    body.entry.forEach(async (entry) => {
      const changes = entry.changes[0];
      const message = changes.value.messages?.[0];

      if (message) {
        const sender = message.from;
        const text = message.text?.body;

        // Process the message
        await handleMessage(sender, text);
      }
    });

    res.status(200).send('Message received');
  } else {
    res.status(404).send('Invalid request');
  }
});

// State Management (In-Memory for now)
const userSessions = {};

// Process Incoming Messages
const handleMessage = async (sender, text) => {
  let response;

  // Normalize the input text
  const normalizedText = text.toLowerCase().trim();

  // Check if the user is starting a new conversation
  if (normalizedText === 'hi' || normalizedText === 'hello') {
    // Reset the session
    userSessions[sender] = { step: 'start' };
    response = `Hello! Do you want to apply for a document or chat with us?`;
  } else {
    // Retrieve or initialize the session
    if (!userSessions[sender]) {
      userSessions[sender] = { step: 'start' };
    }

    const session = userSessions[sender];

    switch (session.step) {
      case 'start':
        response = `Please type "Hi" to start.`;
        break;

      case 'awaiting_action':
        if (normalizedText.includes('apply')) {
          response = `Please provide your district and subdistrict (e.g., "District: Sample District, Subdistrict: Sample Subdistrict").`;
          session.step = 'awaiting_location';
        } else {
          response = `Sorry, I didn't understand that. Please type "Apply" to proceed.`;
        }
        break;

      case 'awaiting_location':
        const [district, subdistrict] = text.split(',').map((part) => part.trim().split(':')[1]);
        if (district && subdistrict) {
          try {
            const centers = await fetchCenters(district, subdistrict); // Replace with actual API call
            if (centers.length > 0) {
              response = `Here are the available Akshya centers:\n${centers.map((c, i) => `${i + 1}. ${c.name}`).join('\n')}\nPlease select a center by typing its number.`;
              session.centers = centers;
              session.step = 'awaiting_center_selection';
            } else {
              response = `No Akshya centers found in your area. Please try again.`;
            }
          } catch (err) {
            console.error(err);
            response = `An error occurred while fetching Akshya centers. Please try again later.`;
          }
        } else {
          response = `Invalid format. Please provide your district and subdistrict (e.g., "District: Sample District, Subdistrict: Sample Subdistrict").`;
        }
        break;

      case 'awaiting_center_selection':
        const centerIndex = parseInt(text) - 1;
        if (centerIndex >= 0 && centerIndex < session.centers.length) {
          const selectedCenter = session.centers[centerIndex];
          session.selectedCenter = selectedCenter._id;

          // Start a user session
          const userData = await startSession(sender, 'English'); // Replace with actual API call
          session.userId = userData.userId;

          response = `You have selected ${selectedCenter.name}. Please type the name of the service you want to apply for.`;
          session.step = 'awaiting_service_selection';
        } else {
          response = `Invalid selection. Please type the number of the center you want to select.`;
        }
        break;

      case 'awaiting_service_selection':
        const serviceName = text;
        const requiredDocuments = ['Proof of Identity', 'Proof of Address', 'Passport Size Photo']; // Example documents

        try {
          const applicationData = await createApplication(session.userId, session.selectedCenter, serviceName, requiredDocuments); // Replace with actual API call
          response = `Your application has been created successfully. Here are the links to upload your documents:\n${applicationData.documentUploadLinks.map((doc) => `${doc.documentName}: ${doc.uploadLink}`).join('\n')}`;
          session.step = 'completed';
        } catch (err) {
          console.error(err);
          response = `An error occurred while creating your application. Please try again later.`;
        }
        break;

      case 'completed':
        response = `Thank you for using ServiceSathi! If you need further assistance, please type "Hi".`;
        session.step = 'start';
        break;

      default:
        response = `An unexpected error occurred. Please type "Hi" to start over.`;
        session.step = 'start';
    }
  }

  // Send the response
  await sendMessageToWhatsApp(sender, response);
};

// Start the server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`WhatsApp Bot Server is running on http://localhost:${PORT}`);
});