// controllers/modules/applyModule.js
const axios       = require('axios');
const CentreModel = require('../../models/Centre');
const UserModel   = require('../../models/wha-user'); // Ensure UserModel is required if needed elsewhere, though not directly used in this snippet

const DOCUMENT_TYPES = [
  { key: 'income_certificate',     name: 'Income Certificate'    },
  { key: 'voter_registration',     name: 'Voter Registration'    },
  { key: 'passport_service',       name: 'Passport Service'      },
  { key: 'utility_payments',       name: 'Utility Payments'      },
  { key: 'possession_certificate', name: 'Possession Certificate' }
];

const DISTRICTS = [
  "Thiruvananthapuram","Kollam","Pathanamthitta","Alappuzha",
  "Kottayam","Idukki","Ernakulam","Thrissur",
  "Palakkad","Malappuram","Kozhikode","Wayanad",
  "Kannur","Kasaragod"
];

// Helper function to resend district prompt
async function promptDistrict(sendMessage, From) {
  await sendMessage(From,
    "*Select your district:* (0️⃣ Cancel)\n" +
    DISTRICTS.map((d, i) => `${i + 1}. ${d}`).join('\n')
  );
}

// Helper function to resend subdistrict prompt
async function promptSubdistrict(sendMessage, From, user) {
  const subs = await CentreModel.distinct(
    'subdistrict',
    { district: user.applyDataTemp.district }
  );
  // Handle case where backtracking reveals no subdistricts (should be rare if validation passed going forward)
  if (!subs.length) {
      console.warn(`No subdistricts found for ${user.applyDataTemp.district} during backtrack.`);
      user.applyState = 'district'; // Force back to district selection
      delete user.applyDataTemp.district; // Clear potentially invalid district choice
      await user.save();
      await sendMessage(From, `Error finding subdistricts for ${user.applyDataTemp.district}. Please select district again.`);
      return promptDistrict(sendMessage, From); // Re-prompt district
  }
  await sendMessage(From,
    `*Select subdistrict in ${user.applyDataTemp.district}:* (0️⃣ Cancel/Back)\n` +
    subs.map((s, i) => `${i + 1}. ${s}`).join('\n')
  );
}

// Helper function to resend document prompt
async function promptDocument(sendMessage, From) {
 await sendMessage(From,
    "*Select document to apply:* (0️⃣ Cancel/Back)\n" +
    DOCUMENT_TYPES.map((d, i) => `${i + 1}. ${d.name}`).join('\n')
  );
}

// Helper function to resend centre prompt
async function promptCentre(sendMessage, From, user) {
    await sendMessage(From,
      "*Select centre:* (0️⃣ Cancel/Back)\n" +
      user.applyDataTemp.centres.map((c, i) =>
        `${i+1}. *${c.centreName}*\n🙎 ${c.ownerName}\n📍 ${c.address}\n📞 ${c.contact}\n🆔 ${c.centreId}`
      ).join('\n\n')
    );
}


module.exports = function(sendMessage, DOCUMENT_SERVICE_API_BASE) {
  return {
    process: async (Body, user, From) => {
      const text  = Body.trim();
      const lower = text.toLowerCase();
      const num   = parseInt(text, 10);

      // --- Improved Back/Cancel Logic ---
      if (lower === '0' || lower === 'back') {
        switch (user.applyState) {
          case 'centre': // If selecting centre, go back to document selection
            user.applyState = 'document';
            // Clear data specific to this step
            delete user.applyDataTemp.centres;
            await user.save();
            console.log("Backtracking: Centre -> Document");
            return promptDocument(sendMessage, From);

          case 'document': // If selecting document, go back to subdistrict selection
            user.applyState = 'subdistrict';
             // Clear data specific to this step
            delete user.applyDataTemp.documentType;
            delete user.applyDataTemp.documentName;
            await user.save();
            console.log("Backtracking: Document -> Subdistrict");
            return promptSubdistrict(sendMessage, From, user);

          case 'subdistrict': // If selecting subdistrict, go back to district selection
            user.applyState = 'district';
             // Clear data specific to this step
            delete user.applyDataTemp.subdistrict;
            await user.save();
            console.log("Backtracking: Subdistrict -> District");
            return promptDistrict(sendMessage, From);

          case 'district': // If selecting district, fully cancel
          default: // Also handles null or unexpected states
            user.applyState    = null;
            user.applyDataTemp = {};
            user.lastOption    = null; // Go back to main menu state
            await user.save();
            console.log("Backtracking: District -> Main Menu (Full Cancel)");
            // Let the main controller handle showing the main menu prompt
            // We can send a confirmation here, though chatbotController might also send one.
            // Consider coordinating this message with chatbotController's back/0 logic.
             return sendMessage(From, "*❌ Application cancelled.* Returning to main menu.");
            // Or potentially: return require('./optionModule')(sendMessage).prompt(user, From);
            // But better to let chatbotController handle the transition back to main menu.
        }
      }

      // --- STEP 0: Start Flow / Prompt District ---
      // This is triggered when optionModule calls process with empty Body
      // Or if somehow the state became null mid-flow.
      if (!user.applyState) {
        console.log("Starting apply flow or restarting from null state.");
        user.applyState    = 'district';
        user.applyDataTemp = {}; // Clear any stale temp data
        await user.save();
        return promptDistrict(sendMessage, From);
      }

      // --- STEP 1: Handle District Input -> Prompt Subdistrict ---
      if (user.applyState === 'district') {
        if (isNaN(num) || num < 1 || num > DISTRICTS.length) {
          return sendMessage(From,
            `Invalid district. Enter 1–${DISTRICTS.length} or 0️⃣ to go back.`
          );
        }
        user.applyDataTemp.district = DISTRICTS[num - 1];
        user.applyState             = 'subdistrict';
        await user.save();
        console.log(`Selected District: ${user.applyDataTemp.district}`);
        // Now prompt for subdistrict
        return promptSubdistrict(sendMessage, From, user); // Use helper
      }

      // --- STEP 2: Handle Subdistrict Input -> Prompt Document ---
      if (user.applyState === 'subdistrict') {
        // Fetch subdistricts again for validation (in case user took time to respond)
        const subs = await CentreModel.distinct(
          'subdistrict',
          { district: user.applyDataTemp.district }
        );
         if (!subs.length) { // Should not happen if validation passed before, but good check
             console.error(`Validation Error: No subdistricts found for ${user.applyDataTemp.district} at step 2.`);
             user.applyState = 'district'; // Send back to district selection
             delete user.applyDataTemp.district; // Clear invalid district
             await user.save();
             await sendMessage(From, `Error finding subdistricts. Please select district again.`);
             return promptDistrict(sendMessage, From);
         }
        if (isNaN(num) || num < 1 || num > subs.length) {
          return sendMessage(From,
            `Invalid subdistrict. Enter 1–${subs.length} or 0️⃣ to go back.`
          );
        }
        user.applyDataTemp.subdistrict = subs[num - 1];
        user.applyState               = 'document';
        await user.save();
        console.log(`Selected Subdistrict: ${user.applyDataTemp.subdistrict}`);
        // Now prompt for document type
        return promptDocument(sendMessage, From); // Use helper
      }

      // --- STEP 3: Handle Document Input -> Prompt Centre List ---
      if (user.applyState === 'document') {
        if (isNaN(num) || num < 1 || num > DOCUMENT_TYPES.length) {
          return sendMessage(From,
            `Invalid choice. Enter 1–${DOCUMENT_TYPES.length} or 0️⃣ to go back.`
          );
        }
        const doc = DOCUMENT_TYPES[num - 1];
        user.applyDataTemp.documentType = doc.key;
        user.applyDataTemp.documentName = doc.name;
        user.applyState                 = 'centre';
        // Clear potentially stale centres data before finding new ones
        delete user.applyDataTemp.centres;
        await user.save(); // Save state before finding centres
        console.log(`Selected Document: ${user.applyDataTemp.documentName}`);

        console.log("🔍 Searching centres:", {
          district:    user.applyDataTemp.district,
          subdistrict: user.applyDataTemp.subdistrict,
          service:     doc.key
        });

        const centres = await CentreModel.find({
          type:        { $in: ['csc', 'akshaya'] },
          district:    user.applyDataTemp.district,
          subdistrict: user.applyDataTemp.subdistrict,
          [`services.${doc.key}`]: true
        }).limit(5); // Limit results for display

        console.log("🏥 Centres found:", centres.length);

        if (!centres.length) {
          user.applyState = 'document'; // Stay in document state
           // Clear the invalid document choice? Optional, maybe let them retry centre search.
          // delete user.applyDataTemp.documentType;
          // delete user.applyDataTemp.documentName;
          await user.save();
          await sendMessage(From,
            "❌ No centres found offering that service in your selected subdistrict.\nChoose another document or enter 0️⃣ to go back:"
          );
           return promptDocument(sendMessage, From); // Re-prompt document
        }

        // Map and store found centres in temp data
        user.applyDataTemp.centres = centres.map(c => ({
          // Ensure defaults are applied robustly
          centreId:   c.centerId || "N/A",
          centreName: c.centreName || "Unnamed Centre",
          ownerName: c.ownerName || "Unknown Owner",
          contact:    c.contact || "No contact info",
          // Construct address safely, checking both parts
          address:    `${c.district || "Unknown District"}, ${c.subdistrict || "Unknown Subdistrict"}`
        })).filter(c => c.centreName !== "Unnamed Centre" || c.centerId !== "N/A"); // Basic filter for totally empty-ish entries

         // Check if filtering removed all centres (unlikely but possible if data is very bad)
         if (!user.applyDataTemp.centres.length) {
             console.error("Error: All found centres had missing critical info (Name/ID).");
             user.applyState = 'document'; // Revert state
             await user.save();
             await sendMessage(From, "❌ Error retrieving centre details. Please try selecting the document again or enter 0️⃣ to go back.");
             return promptDocument(sendMessage, From);
         }

        await user.save(); // Save the mapped centres list

        // Prompt user to select a centre
        return promptCentre(sendMessage, From, user); // Use helper
      }

      // --- STEP 4: Handle Centre Input -> Create Request ---
      if (user.applyState === 'centre') {
        // Retrieve the list saved in the previous step
        const list = user.applyDataTemp.centres || [];
         if (!list.length) { // Should not happen if validation passed before, but good check
            console.error("Error: Centre list was empty at step 4.");
            user.applyState = 'document'; // Send back
            delete user.applyDataTemp.centres; // Clear bad data
            await user.save();
            await sendMessage(From, "Error retrieving centre list. Please select document again or enter 0️⃣ to go back.");
            return promptDocument(sendMessage, From);
         }

        if (isNaN(num) || num < 1 || num > list.length) {
          return sendMessage(From,
            `Invalid choice. Enter 1–${list.length} or 0️⃣ to go back.`
          );
        }
        const chosen = list[num - 1];
        console.log(`Selected Centre: ${chosen.centreName} (ID: ${chosen.centreId})`);

        try {
          // --- API Call to Document Service ---
          console.log("📤 Calling Document Service API:", {
             "document-type": user.applyDataTemp.documentName,
             "centre-id":     chosen.centreId
           });
          const apiRes = await axios.post(
            `${DOCUMENT_SERVICE_API_BASE}/api/service-request`,
            {
              "document-type": user.applyDataTemp.documentName,
              "centre-id":     chosen.centreId
            }
          );
          const data = apiRes.data;
          console.log("✅ Document Service API Response:", data);


          // --- Save Application Details to User ---
          user.applications.push({
            district:         user.applyDataTemp.district,
            subdistrict:      user.applyDataTemp.subdistrict,
            centreId:         chosen.centreId,
            documentType:     user.applyDataTemp.documentType,
            documentName:     user.applyDataTemp.documentName,
            serviceRequestId: data.serviceRequestId || "N/A", // Handle missing ID
            requiredDocuments: Array.isArray(data.requiredDocuments) ? data.requiredDocuments.map(d => ({ // Ensure it's an array
              name: d.name || "Unknown Document", // Handle missing name
              uploadedFile: d.uploadedFile || ""
            })) : [], // Default to empty array if not provided correctly
            uploadLink:       data.uploadLink || "Not Provided" // Handle missing link
          });

          // --- Reset State and Clean Up ---
          user.applyState    = null;
          user.applyDataTemp = {};
          user.lastOption    = null; // Go back to main menu state
          await user.save();

          // --- Send Confirmation to User ---
          // Construct required docs list safely
          const reqDocsList = Array.isArray(data.requiredDocuments) && data.requiredDocuments.length > 0
             ? data.requiredDocuments.map(d => `• ${d.name || 'Unknown Document'}`).join('\n')
             : "None specified.";

          return sendMessage(From,
            `*${data.message || 'Application submitted successfully!'}*\n` + // Default success message
            `Request ID: ${data.serviceRequestId || 'N/A'}\n` +
            `Required Docs:\n${reqDocsList}\n` +
            `Upload Link: ${data.uploadLink || 'Not Provided'}`
          );

        } catch (err) {
           // Log detailed error from API call
           console.error("❌ Service-request API error:", err.response ? { status: err.response.status, data: err.response.data } : err.message);

           // Provide informative feedback to the user
           // Don't revert state here, let them retry selecting the centre or go back
           return sendMessage(From,
             "❌ Error submitting your request to the selected centre. Please try selecting the centre again, or enter 0️⃣ to go back."
           );
        }
      }

      // --- Final Fallback for Unexpected States ---
      console.warn(`Reached unexpected state in applyModule: ${user.applyState} with input: ${Body}`);
      // Optionally try to recover or just guide user to restart
      // user.applyState = null; // Reset state as a safety measure
      // user.applyDataTemp = {};
      // await user.save();
      return sendMessage(From,
        "⚠️ Something went wrong with the application process. Please type 'hi' to restart, or enter 0️⃣ to go back."
      );
    }
  };
};