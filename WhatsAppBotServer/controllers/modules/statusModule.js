// controllers/modules/statusModule.js
const axios = require('axios');

module.exports = function(sendMessage, DOCUMENT_SERVICE_API_BASE) {
  return {
    // Call this when user sends '/service'
    checkAll: async (user, From) => {
      try {
        const phone = encodeURIComponent(user.phoneNumber);
        const { data: requests } = await axios.get(
          `${DOCUMENT_SERVICE_API_BASE}/service-request/phone/${phone}`
        );

        if (!Array.isArray(requests) || !requests.length) {
          return sendMessage(From, "You have no service requests on record.");
        }

        // Build one message per request (or batch)
        for (const req of requests) {
          const lines = [
            `🆔 Request ID: ${req._id}`,
            `📄 Document: ${req.documentType}`,
            `🏢 Centre: ${req.centreId}`,
            `📱 Mobile: ${req.mobileNumber}`,
            `🔄 Status: ${req.status}`,
            `🗓️ Created: ${new Date(req.createdAt).toLocaleString()}`
          ];
          await sendMessage(From, lines.join('\n'));
        }
      } catch (err) {
        console.error('Status‑check error:', err.response?.data || err.message);
        await sendMessage(From,
          "Sorry, I couldn't fetch your service status. Try again later."
        );
      }
    }
  };
};
