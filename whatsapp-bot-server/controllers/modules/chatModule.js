// controllers/modules/chatModule.js
const axios = require('axios');

module.exports = function(sendMessage, CHAT_API_BASE, logger, AXIOS_TIMEOUT) {
  return {
    process: async (Body, user, From) => {
      const payload = {
        query: Body, // Already sanitized in controller
        translate: user.language === "malayalam",
        // Optional: Pass user ID or session ID if your chat API supports context/history
        // userId: user.phoneNumber
      };
      // Conditionally add mode for Malayalam translation
      if (user.language === "malayalam") {
        payload.mode = "ENG-MAL";
      }

      let reply;
      try {
        logger.info(`Sending query to Chat API for user ${user.phoneNumber}: ${Body}`);
        const apiRes = await axios.post(
            `${CHAT_API_BASE}/generate`,
            payload,
            { timeout: AXIOS_TIMEOUT } // Add timeout
        );
        // TODO: Implement content moderation check on the response if needed
        // This depends on the API's capabilities and your requirements.
        // Example: if (isHarmful(apiRes.data?.response)) { throw new Error('Harmful content detected'); }
        reply = apiRes.data?.response;
        logger.info(`Received Chat API response for user ${user.phoneNumber}: ${reply}`);

      } catch (e) {
        logger.error(`Chat API error for user ${user.phoneNumber}:`, e.response?.data || e.message || e);
        // Provide specific messages for common errors if possible
        if (e.code === 'ECONNABORTED') { // Axios timeout
             reply = user.language === "malayalam"
                 ? "ക്ഷമിക്കണം, ചാറ്റ് സേവനം പ്രതികരിക്കാൻ കൂടുതൽ സമയമെടുക്കുന്നു. ദയവായി അൽപസമയം കഴിഞ്ഞ് വീണ്ടും ശ്രമിക്കുക."
                 : "Sorry, the chat service is taking too long to respond. Please try again in a moment.";
        } else if (e.message === 'Harmful content detected') {
             reply = user.language === "malayalam"
                 ? "ക്ഷമിക്കണം, എനിക്ക് ആ വിഷയത്തിൽ പ്രതികരിക്കാൻ കഴിയില്ല."
                 : "Sorry, I cannot respond to that topic.";
        }
         // Generic fallback error message handled below
      }

      // Fallback message if reply is empty or an error occurred without a specific message
      if (!reply) {
        reply = user.language === "malayalam"
          ? "ക്ഷമിക്കണം, ഒരു പിശക് സംഭവിച്ചു. ദയവായി വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ പ്രധാന മെനുവിലേക്ക് മടങ്ങാൻ 'back' ടൈപ്പ് ചെയ്യുക."
          : "Sorry, an error occurred. Please try again, or type 'back' to return to the main menu.";
      }

      await sendMessage(From, reply);
    }
  };
};