  // controllers/modules/languageModule.js
  module.exports = function(sendMessage) {
    return {
      prompt: async (From) => {
        await sendMessage(From,
          "*✨ Welcome to SERVICE SAATHI - Akshaya Centre! ✨*\n" +
          "Please choose your language:\n1️⃣ English\n2️⃣ Malayalam\n" +
          "_(Change language anytime with /LANG)_"
        );
      },
      choose: async (Body, user, From) => {
        if (Body === "1") {
          user.language = "english";
          await user.save();
          await sendMessage(From,
            "*Hello!* Please choose:\n1️⃣ Chat\n2️⃣ Apply for Document\n" +
            "_(Change language with /LANG)_"
          );
        } else if (Body === "2") {
          user.language = "malayalam";
          await user.save();
          await sendMessage(From,
            "*ഹലോ!* ദയവായി തിരഞ്ഞെടുക്കുക:\n1️⃣ ചാറ്റ്\n2️⃣ ഡോക്യുമെന്റ് അപേക്ഷ\n" +
            "_(ഭാഷ മാറ്റത്തിന് /LANG)_"
          );
        } else {
          await sendMessage(From,
            "*Invalid input.* Please type 'hi' to start and then choose:\n1️⃣ English\n2️⃣ Malayalam"
          );
        }
      }
    };
  };
