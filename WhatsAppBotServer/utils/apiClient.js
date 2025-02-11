const axios = require('axios');
const BASE_URL = process.env.SERVICE_SATHI_API_BASE_URL;

// Start a user session
const startSession = async (phoneNumber, languagePreference) => {
  const response = await axios.post(`${BASE_URL}/whatsapp/start-session`, {
    phoneNumber,
    languagePreference,
  });
  return response.data;
};

// Fetch Akshya centers by location
const fetchCenters = async (district, subdistrict) => {
  const response = await axios.post(`${BASE_URL}/whatsapp/centers`, {
    district,
    subdistrict,
  });
  return response.data;
};

// Create a service application
const createApplication = async (userId, centerId, serviceName, requiredDocuments) => {
  const response = await axios.post(`${BASE_URL}/whatsapp/apply`, {
    userId,
    centerId,
    serviceName,
    requiredDocuments,
  });
  return response.data;
};

module.exports = { startSession, fetchCenters, createApplication };