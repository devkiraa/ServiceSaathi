// controllers/modules/languageModule.js
module.exports = function(sendMessage, logger) { // Added logger
  // Helper to send the main menu prompt after language selection
  async function sendMainMenuPrompt(user, From) {
      const optionModule = require('./optionModule')(sendMessage, null, null, logger, null); // Re-require partially
      await optionModule.prompt(user, From);
  }

  return {
    prompt: async (From) => {
      logger.info(`Prompting language selection for ${From}`);
      await sendMessage(From,
        "*✨ Welcome to SERVICE SAATHI ✨*\n\n" + // Added newline for spacing
        "Please choose your language | ദയവായി നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക:\n\n" +
        "1️⃣ English\n" +
        "2️⃣ മലയാളം (Malayalam)\n\n" +
        "_(You can change language anytime by sending /LANG | എപ്പോൾ വേണമെങ്കിലും /LANG എന്ന് അയച്ച് ഭാഷ മാറ്റാവുന്നതാണ്)_"
      );
    },

    choose: async (Body, user, From) => {
      const choice = Body.trim(); // Trim input

      if (choice === "1") {
        user.language = "english";
        await user.save();
        logger.info(`User ${user.phoneNumber} selected language: English`);
        await sendMessage(From, "Language set to English.");
        await sendMainMenuPrompt(user, From); // Show main menu immediately

      } else if (choice === "2") {
        user.language = "malayalam";
        await user.save();
        logger.info(`User ${user.phoneNumber} selected language: Malayalam`);
        await sendMessage(From, "ഭാഷ മലയാളത്തിലേക്ക് മാറ്റിയിരിക്കുന്നു.");
        await sendMainMenuPrompt(user, From); // Show main menu immediately

      } else {
        logger.warn(`Invalid language selection '${choice}' from ${user.phoneNumber}`);
        // Resend the prompt without changing the language state
        await sendMessage(From,
          "*Invalid input | തെറ്റായ ഇൻപുട്ട്.*\n\n" +
          "Please choose | ദയവായി തിരഞ്ഞെടുക്കുക:\n" +
          "1️⃣ English\n" +
          "2️⃣ മലയാളം (Malayalam)"
        );
      }
    }
  };
};