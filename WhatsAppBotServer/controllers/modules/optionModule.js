// controllers/modules/optionModule.js
const axios = require('axios');

module.exports = function(sendMessage, applyModule, CHAT_API_BASE, logger, AXIOS_TIMEOUT) {

  // Define prompt function first so it's accessible within choose
  const prompt = async (user, From) => {
      logger.info(`Showing main menu to ${user.phoneNumber} in ${user.language}`);
      const msg = user.language === "malayalam"
        ? "*പ്രധാന മെനു | Main Menu*\n\n" +
          "ദയവായി ഒരു ഓപ്ഷൻ തിരഞ്ഞെടുക്കുക:\n\n" +
          "1️⃣ ചാറ്റ് (Chat with AI Assistant)\n" +
          "2️⃣ ഡോക്യുമെന്റ് അപേക്ഷിക്കുക (Apply for Document)\n" +
          "\n_(നിങ്ങളുടെ അപേക്ഷകളുടെ നിലവിലെ അവസ്ഥ അറിയാൻ /service എന്ന് അയക്കുക. | Send /service to check application status)_" +
          "\n_(ഭാഷ മാറ്റാൻ /LANG എന്ന് അയക്കുക | Send /LANG to change language)_"
        : "*Main Menu*\n\n" +
          "Please choose an option:\n\n" +
          "1️⃣ Chat with AI Assistant\n" +
          "2️⃣ Apply for Document\n" +
          "\n_(Send /service to check your application status)_" +
          "\n_(Send /LANG to change language)_";
      await sendMessage(From, msg);
    };


  // Define choose function
  const choose = async (Body, user, From) => {
      const choice = Body.trim();
      logger.info(`User ${user.phoneNumber} chose option: ${choice}`);

      if (choice === "1") {
        // Check if Chat API is online before proceeding
        try {
          // Removed verbose ping log - uncomment if needed for debugging
          // logger.info(`Pinging Chat API at ${CHAT_API_BASE}/ping for user ${user.phoneNumber}`);
          const statusCheck = await axios.get(`${CHAT_API_BASE}/ping`, { timeout: AXIOS_TIMEOUT / 2 });

          if (statusCheck.status !== 200 || statusCheck.data?.status === "offline") {
             throw new Error(`Chat API status check failed or returned offline. Status: ${statusCheck.status}, Data: ${JSON.stringify(statusCheck.data)}`);
          }

          user.lastOption = "chat";
          await user.save();
          logger.info(`User ${user.phoneNumber} entering chat mode.`);
          const msg = user.language === "malayalam"
            ? "*ചാറ്റ് മോഡ് സജീവമാക്കി.* നിങ്ങൾക്ക് ഇപ്പോൾ AI അസിസ്റ്റന്റിനോട് സംസാരിക്കാം.\n\nപ്രധാന മെനുവിലേക്ക് മടങ്ങാൻ എപ്പോൾ വേണമെങ്കിലും 'back' അല്ലെങ്കിൽ '0' എന്ന് ടൈപ്പ് ചെയ്യുക."
            : "*Chat mode activated.* You can now talk to the AI assistant.\n\nType 'back' or '0' anytime to return to the main menu.";
          return sendMessage(From, msg);

        } catch (err) {
          // Log the error, but not the verbose ping initiation
          logger.error(`Chat API health check failed for user ${user.phoneNumber}:`, err.message);
          const offlineMsg = user.language === "malayalam"
            ? "ക്ഷമിക്കണം, ചാറ്റ് സേവനം ഇപ്പോൾ ലഭ്യമല്ല. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക. നിങ്ങൾക്ക് ഇപ്പോഴും ഡോക്യുമെന്റിനായി അപേക്ഷിക്കാം (ഓപ്ഷൻ 2)."
            : "Sorry, the chat service is currently unavailable. Please try again later. You can still apply for a document (Option 2).";
          await sendMessage(From, offlineMsg);

          // *** FIX: Call prompt directly ***
          await prompt(user, From); // Re-prompt main menu correctly
          return;
        }
      }

      if (choice === "2") {
        user.lastOption = "apply";
        await user.save();
        logger.info(`User ${user.phoneNumber} entering apply mode.`);
        return applyModule.process("", user, From);
      }

      logger.warn(`Invalid main menu option '${choice}' from ${user.phoneNumber}`);
      const inv = user.language === "malayalam"
        ? "*തെറ്റായ ഓപ്ഷൻ.* ദയവായി 1 അല്ലെങ്കിൽ 2 തിരഞ്ഞെടുക്കുക. വീണ്ടും ആരംഭിക്കാൻ 'hi' എന്ന് ടൈപ്പ് ചെയ്യുക."
        : "*Invalid option.* Please choose 1 or 2. Type 'hi' to restart.";
      await sendMessage(From, inv);
      await prompt(user, From); // Re-prompt main menu
    };

  // Return the functions in the exported object
  return {
    prompt,
    choose
  };
};