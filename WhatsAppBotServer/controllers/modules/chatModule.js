// controllers/modules/chatModule.js
const axios = require('axios');

module.exports = function(sendMessage, CHAT_API_BASE) {
  return {
    process: async (Body, user, From) => {
      const payload = {
        query: Body,
        translate: user.language === "malayalam"
      };
      if (user.language === "malayalam") payload.mode = "ENG-MAL";

      let reply;
      try {
        const apiRes = await axios.post(`${CHAT_API_BASE}/generate`, payload);
        reply = apiRes.data?.response;
      } catch (e) {
        console.error("Chat API error:", e);
      }
      if (!reply) {
        reply = user.language === "malayalam"
          ? "ക്ഷമിക്കണം, പ്രശ്നം വന്നിരിക്കുന്നു. വീണ്ടും ശ്രമിക്കുക."
          : "Sorry, something went wrong. Please try again.";
      }
      await sendMessage(From, reply);
    }
  };
};
