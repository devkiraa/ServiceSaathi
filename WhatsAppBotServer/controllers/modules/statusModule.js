// controllers/modules/statusModule.js
const axios = require('axios');

// Define locale for date formatting consistency
const DATE_LOCALE = 'en-IN'; // Example: India locale
const DATE_OPTIONS = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true };

// Maximum requests to show per message batch
const MAX_REQUESTS_PER_BATCH = 3;

module.exports = function(sendMessage, DOCUMENT_SERVICE_API_BASE, logger, AXIOS_TIMEOUT) {

    // Helper function to format a single request
    function formatRequest(req, language, includeAppName = false) {
         // Find the corresponding application details stored in the user object if needed (e.g., for documentName)
         // This assumes the user object is available or passed here. For simplicity, we use data from the API response.
         const appName = req.documentName || req.documentType; // Use name if available from API, else type

         const statusText = req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : 'Unknown';
         const createdDate = req.createdAt ? new Date(req.createdAt).toLocaleString(DATE_LOCALE, DATE_OPTIONS) : 'N/A';

         // Provide more user-friendly status messages
         let statusDisplay = statusText;
         if (language === 'malayalam') {
            switch (statusText.toLowerCase()) {
                case 'initiated': statusDisplay = 'ആരംഭിച്ചു'; break;
                case 'submitted': statusDisplay = 'സമർപ്പിച്ചു'; break;
                case 'processing': statusDisplay = 'പ്രോസസ്സ് ചെയ്യുന്നു'; break;
                case 'completed': statusDisplay = 'പൂർത്തിയായി'; break;
                case 'rejected': statusDisplay = 'നിരസിച്ചു'; break;
                case 'failed': statusDisplay = 'പരാജയപ്പെട്ടു'; break;
                case 'cancelled': statusDisplay = 'റദ്ദാക്കി'; break;
                default: statusDisplay = statusText; // Fallback to original if unknown
            }
         }


         const lines = [
             `*${language === 'malayalam' ? 'അഭ്യർത്ഥന' : 'Request'} ID:* ${req._id || req.serviceRequestId || 'N/A'}`, // Use _id or serviceRequestId
             `*${language === 'malayalam' ? 'ഡോക്യുമെന്റ്' : 'Document'}:* ${appName}`,
             // `🏢 Centre: ${req.centreId || 'N/A'}`, // Maybe less important for user status check?
             `*${language === 'malayalam' ? 'നില' : 'Status'}:* ${statusDisplay}`,
             `*${language === 'malayalam' ? 'സമർപ്പിച്ചത്' : 'Submitted'}:* ${createdDate}`
         ];
         return lines.join('\n');
    }

  return {
    // Call this when user sends '/service'
    checkAll: async (user, From) => {
      logger.info(`Fetching service status for user ${user.phoneNumber}`);
      try {
        // Ensure phone number is encoded correctly for URL
        const phone = encodeURIComponent(user.phoneNumber);
        const apiUrl = `${DOCUMENT_SERVICE_API_BASE}/service-request/phone/${phone}`;
        logger.info(`Calling status API: ${apiUrl}`);

        const { data: requests } = await axios.get(apiUrl, { timeout: AXIOS_TIMEOUT });

        if (!Array.isArray(requests) || requests.length === 0) {
          logger.info(`No service requests found for user ${user.phoneNumber}`);
          const noReqMsg = user.language === 'malayalam'
             ? "നിങ്ങളുടെ പേരിൽ നിലവിൽ സേവന അഭ്യർത്ഥനകളൊന്നും റെക്കോർഡിൽ ഇല്ല."
             : "You have no service requests currently on record.";
          return sendMessage(From, noReqMsg);
        }

        logger.info(`Found ${requests.length} requests for user ${user.phoneNumber}`);

        // Sort requests by creation date, newest first
        requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Batch requests into multiple messages if necessary
        let messageBatch = [];
        let batchCount = 0;
        const totalRequests = requests.length;

        await sendMessage(From, user.language === 'malayalam'
            ? `നിങ്ങളുടെ ${totalRequests} സേവന അഭ്യർത്ഥനകളുടെ നില താഴെ നൽകുന്നു:`
            : `Status of your ${totalRequests} service request(s):`);

        for (let i = 0; i < totalRequests; i++) {
            const req = requests[i];
            messageBatch.push(formatRequest(req, user.language));
            batchCount++;

            // Send message if batch is full or it's the last request
            if (batchCount === MAX_REQUESTS_PER_BATCH || i === totalRequests - 1) {
                await sendMessage(From, messageBatch.join('\n\n---\n\n')); // Separator between requests
                messageBatch = []; // Reset batch
                batchCount = 0;
                // Optional: Add a small delay between messages to avoid rate limiting issues
                if (i < totalRequests - 1) await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

      } catch (err) {
        logger.error(`Status check API error for user ${user.phoneNumber}:`, err.response?.data || err.message);
        const errorMsg = user.language === 'malayalam'
           ? "ക്ഷമിക്കണം, നിങ്ങളുടെ സേവന നില പരിശോധിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക."
           : "Sorry, I couldn't fetch your service status at this time. Please try again later.";
        await sendMessage(From, errorMsg);
      }
    }
  };
};