// controllers/modules/optionModule.js
module.exports = function(sendMessage, applyModule) {
  return {
    // Show the main menu
    prompt: async (user, From) => {
      const msg = user.language === "malayalam"
        ? "*ദയവായി തിരഞ്ഞെടുക്കുക:*\n1️⃣ ചാറ്റ്\n2️⃣ ഡോക്യുമെന്റ് അപേക്ഷ\n(ഭാഷ മാറ്റത്തിന് /LANG)"
        : "*Please choose an option:*\n1️⃣ Chat\n2️⃣ Apply for Document\n(To change language, send /LANG)";
      await sendMessage(From, msg);
    },

    // Handle the user's choice
    choose: async (Body, user, From) => {
      if (Body === "1") {
        // Chat mode
        user.lastOption = "chat";
        await user.save();
        const msg = user.language === "malayalam"
          ? "*ചാറ്റ് മോഡ് സജീവമാക്കി.* ടൈപ്പ് ചെയ്യുക. മെയിൻ മെനുവിലേക്ക് 'back' അല്ലെങ്കിൽ '0'."
          : "*Chat mode activated.* Type anything. Return to menu with 'back' or '0'.";
        return sendMessage(From, msg);
      }

      if (Body === "2") {
        // Apply for document — set state and immediately invoke applyModule
        user.lastOption = "apply";
        await user.save();
        // Start the apply flow (first prompt for district)
        return applyModule.process("", user, From);
      }

      // Invalid selection
      const inv = user.language === "malayalam"
        ? "*അസാധുവായ ഓപ്ഷൻ.* 'hi' ടൈപ്പ് ചെയ്ത് വീണ്ടും ആരംഭിക്കുക."
        : "*Invalid option.* Type 'hi' to restart.";
      return sendMessage(From, inv);
    }
  };
};
