// controllers/modules/applyModule.js
const axios = require('axios');
const CentreModel = require('../../models/Centre');
const ServiceModel = require('../../models/Service');

// TODO: Consider loading DISTRICTS from a config file or API endpoint for easier updates
const DISTRICTS = [
  "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha",
  "Kottayam", "Idukki", "Ernakulam", "Thrissur",
  "Palakkad", "Malappuram", "Kozhikode", "Wayanad",
  "Kannur", "Kasaragod"
];

const POLLING_INTERVAL_MS = 30 * 1000; // Increased polling interval to 30 seconds
const MAX_POLLING_ATTEMPTS = 60; // Poll for a maximum of 30 minutes (60 attempts * 30 seconds)
const TERMINAL_STATUSES = ['submitted', 'rejected', 'failed', 'cancelled']; // Statuses that stop polling

// Store active polling intervals to prevent duplicates and manage them
const activePolls = new Map();

module.exports = function(sendMessage, DOCUMENT_SERVICE_API_BASE, logger, AXIOS_TIMEOUT) {

  // Stop and remove a polling interval
  function stopPolling(requestId, intervalId) {
    if (intervalId) {
      clearInterval(intervalId);
    }
    activePolls.delete(requestId);
    logger.info(`Polling stopped for request ID: ${requestId}`);
  }

  // Helper: poll status endpoint and notify on terminal states
  async function pollStatus(requestId, to, userLanguage) {
    // If already polling for this request, don't start another one
    if (activePolls.has(requestId)) {
       logger.warn(`Polling already active for request ID: ${requestId}. Skipping new poll start.`);
       return;
    }

    let attempts = 0;
    const intervalId = setInterval(async () => {
      attempts++;
      if (attempts > MAX_POLLING_ATTEMPTS) {
        logger.warn(`Max polling attempts reached for request ID: ${requestId}`);
        await sendMessage(to, userLanguage === 'malayalam'
           ? `നിങ്ങളുടെ അഭ്യർത്ഥനയുടെ (${requestId}) സ്റ്റാറ്റസ് പരിശോധിക്കുന്നതിൽ കാലതാമസം നേരിടുന്നു. ദയവായി പിന്നീട് '/service' ഉപയോഗിച്ച് പരിശോധിക്കുക.`
           : `Checking the status for your request (${requestId}) is taking longer than expected. Please check manually later using /service.`
        );
        stopPolling(requestId, intervalId);
        return;
      }

      try {
        const { data } = await axios.get(
          `${DOCUMENT_SERVICE_API_BASE}/service-request/${requestId}/status`,
          { timeout: AXIOS_TIMEOUT } // Add timeout to polling request
        );

        logger.info(`Poll status for ${requestId}: ${data.status}`); // Log current status

        if (TERMINAL_STATUSES.includes(data.status?.toLowerCase())) {
          let message = '';
          switch (data.status.toLowerCase()) {
            case 'submitted':
              message = userLanguage === 'malayalam'
                ? `✅ (${requestId}) നിങ്ങളുടെ ഡോക്യുമെന്റുകൾ വിജയകരമായി ലഭിച്ചു!`
                : `✅ (${requestId}) Your documents have been received successfully!`;
              break;
            case 'rejected':
            case 'failed':
              message = userLanguage === 'malayalam'
                 ? `❌ (${requestId}) നിങ്ങളുടെ അഭ്യർത്ഥന നിരസിച്ചു/പരാജയപ്പെട്ടു. കൂടുതൽ വിവരങ്ങൾക്ക് കേന്ദ്രവുമായി ബന്ധപ്പെടുക.`
                 : `❌ (${requestId}) Your application status is: ${data.status}. Please contact the centre for details.`;
              break;
            case 'cancelled':
               message = userLanguage === 'malayalam'
                 ? `ℹ️ (${requestId}) നിങ്ങളുടെ അഭ്യർത്ഥന റദ്ദാക്കി.`
                 : `ℹ️ (${requestId}) Your service request has been cancelled.`;
               break;
          }
          if (message) {
             await sendMessage(to, message);
          }
          stopPolling(requestId, intervalId); // Stop polling on terminal status
        }
      } catch (err) {
        logger.error(`Error polling status for ${requestId}:`, err.response?.data || err.message);
        // Optional: Notify user after several consecutive errors?
        // For now, just log and continue polling until max attempts
      }
    }, POLLING_INTERVAL_MS);

    activePolls.set(requestId, intervalId); // Store the interval ID
    logger.info(`Polling started for request ID: ${requestId}`);
  }

  // Helper: Clear application state and go to main menu
  async function cancelAndGoToMainMenu(user, From) {
      user.applyState = null; // Use null instead of delete for better Mongoose handling
      user.applyDataTemp = {};
      user.lastOption = null;
      await user.save();
      // Use optionModule to show the correct language menu
      const optionModule = require('./optionModule')(sendMessage, module.exports, null, logger, AXIOS_TIMEOUT); // Re-require partially to avoid circular dep issues if structured differently
      await optionModule.prompt(user, From);
  }


  return {
    process: async (Body, user, From) => {
      const lower = Body.trim().toLowerCase();
      const num = parseInt(Body.trim(), 10); // Trim input before parsing

      // --- Command Handling specific to Apply Flow ---

      // '/cancel': Cancels the *last submitted* service request via API.
      // This is a global command but logically placed here as it interacts with applications.
      if (lower === '/cancel') {
          // Ensure user.applications is an array
          const apps = Array.isArray(user.applications) ? user.applications : [];
          const last = apps.length > 0 ? apps[apps.length - 1] : null;

          if (!last || !last.serviceRequestId) {
              await sendMessage(From, user.language === 'malayalam'
                  ? "റദ്ദാക്കാൻ സജീവമായ സേവന അഭ്യർത്ഥനകളൊന്നും നിങ്ങൾക്കില്ല."
                  : "You have no active service requests to cancel.");
              return cancelAndGoToMainMenu(user, From); // Go to main menu
          }
          try {
              logger.info(`User ${user.phoneNumber} attempting to cancel request ${last.serviceRequestId}`);
              await axios.post(
                  `${DOCUMENT_SERVICE_API_BASE}/service-request/${last.serviceRequestId}/cancel`,
                  null, // No body needed for cancel usually
                  { timeout: AXIOS_TIMEOUT }
              );

              // Stop polling if it was active for this request
              const pollIntervalId = activePolls.get(last.serviceRequestId);
              stopPolling(last.serviceRequestId, pollIntervalId);

              // remove from user record
              user.applications = apps.filter(a => a.serviceRequestId !== last.serviceRequestId);
              // Also clear any ongoing apply flow state
              user.applyState = null;
              user.applyDataTemp = {};
              user.lastOption = null;
              await user.save();

              await sendMessage(From, user.language === 'malayalam'
                  ? `❌ നിങ്ങളുടെ സേവന അഭ്യർത്ഥന (${last.serviceRequestId}) റദ്ദാക്കിയിരിക്കുന്നു.`
                  : `❌ Your service request (${last.serviceRequestId}) has been cancelled.`);
          } catch (err) {
              logger.error(`Error cancelling request ${last.serviceRequestId}:`, err.response?.data || err.message);
              await sendMessage(From, user.language === 'malayalam'
                  ? "റദ്ദാക്കുന്നതിൽ പരാജയപ്പെട്ടു. ദയവായി പിന്നീട് വീണ്ടും ശ്രമിക്കുക."
                  : 'Failed to cancel the request. Please try again later.');
              // Don't exit flow, let user decide next step or retry /cancel
          }
          return cancelAndGoToMainMenu(user, From); // Go to main menu after attempting cancel
      }

      // '0': Cancels the *current interactive application flow* and returns to the main menu.
      if (lower === '0') {
        logger.info(`User ${user.phoneNumber} cancelled application flow at state: ${user.applyState}`);
        await sendMessage(From, user.language === 'malayalam'
            ? "നിലവിലെ അപേക്ഷ റദ്ദാക്കി. പ്രധാന മെനുവിലേക്ക് മടങ്ങുന്നു."
            : "Current application cancelled. Returning to main menu.");
        return cancelAndGoToMainMenu(user, From);
      }

      // 'back': Steps back one stage in the application flow.
      if (lower === 'back') {
        let message = "";
        switch (user.applyState) {
          case 'subdistrict':
            user.applyState = 'district';
            user.applyDataTemp = { ...user.applyDataTemp, subdistrict: undefined }; // Clear specific field
            message = `*Select district:* (0️⃣ Cancel)\n` +
              DISTRICTS.map((d, i) => `${i + 1}. ${d}`).join('\n');
            break;
          case 'document':
            user.applyState = 'subdistrict';
            user.applyDataTemp = { ...user.applyDataTemp, documentType: undefined, documentName: undefined };
            // Refetch subdistricts for the current district
            const subs = await CentreModel.distinct('subdistrict', { district: user.applyDataTemp.district });
             if (!subs.length) { // Should not happen if they got here, but check anyway
                message = `No subdistricts found for ${user.applyDataTemp.district}. Returning to district selection.\n*Select district:* (0️⃣ Cancel)\n` + DISTRICTS.map((d, i) => `${i + 1}. ${d}`).join('\n');
                user.applyState = 'district';
             } else {
                message = `*Select subdistrict:* (0️⃣ Cancel, back to district)\n` +
                subs.map((s, i) => `${i + 1}. ${s}`).join('\n');
             }
            break;
          case 'centre':
            user.applyState = 'document';
            user.applyDataTemp = { ...user.applyDataTemp, centres: undefined, centreId: undefined }; // Clear selected centre too
            // Refetch services
            const services = await ServiceModel.find().sort({ name: 1 });
             if (!services.length) { // Should not happen, but check
                 message = `No services found. Returning to subdistrict selection.\n*Select subdistrict:* (0️⃣ Cancel, back to district)\n...`; // Need to refetch subs here too
                 // Refetch subs based on user.applyDataTemp.district... (add logic if needed)
                 user.applyState = 'subdistrict';
             } else {
                 message = `*Select document to apply:* (0️⃣ Cancel, back to subdistrict)\n` +
                 services.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
             }
            break;
          default: // 'back' from initial state or unexpected state
            logger.info(`User ${user.phoneNumber} used 'back' from state: ${user.applyState}. Returning to menu.`);
            await sendMessage(From, user.language === 'malayalam' ? "പ്രധാന മെനുവിലേക്ക് മടങ്ങുന്നു." : "Returning to main menu.");
            return cancelAndGoToMainMenu(user, From);
        }
        await user.save();
        await sendMessage(From, message);
        return; // Return after handling 'back'
      }

      // --- Application Flow Steps ---

      // STEP 1: Start - Prompt for District
      if (!user.applyState) {
        user.applyState = 'district';
        user.applyDataTemp = {}; // Ensure it's initialized
        await user.save();
        logger.info(`User ${user.phoneNumber} starting application flow.`);
        const prompt = user.language === 'malayalam'
          ? `*ജില്ല തിരഞ്ഞെടുക്കുക:* (0️⃣ റദ്ദാക്കുക)\n` + DISTRICTS.map((d, i) => `${i + 1}. ${d}`).join('\n')
          : `*Select district:* (0️⃣ Cancel)\n` + DISTRICTS.map((d, i) => `${i + 1}. ${d}`).join('\n');
        return sendMessage(From, prompt);
      }

      // STEP 2: District selected → Prompt for Subdistrict
      if (user.applyState === 'district') {
        if (isNaN(num) || num < 1 || num > DISTRICTS.length) {
          return sendMessage(From, user.language === 'malayalam'
            ? `തെറ്റായ ഇൻപുട്ട്. ദയവായി 1–${DISTRICTS.length} ഇടയിലുള്ള ഒരു നമ്പർ നൽകുക അല്ലെങ്കിൽ റദ്ദാക്കാൻ 0️⃣ നൽകുക.`
            : `Invalid input. Please enter a number between 1–${DISTRICTS.length}, or 0️⃣ to cancel.`
          );
        }
        user.applyDataTemp.district = DISTRICTS[num - 1];
        user.applyState = 'subdistrict';
        await user.save();
        logger.info(`User ${user.phoneNumber} selected district: ${user.applyDataTemp.district}`);

        try {
          const subs = await CentreModel.distinct('subdistrict', { district: user.applyDataTemp.district });
          if (!subs.length) {
            user.applyState = 'district'; // Revert state
            await user.save();
            logger.warn(`No subdistricts found for district: ${user.applyDataTemp.district}`);
            const msg = user.language === 'malayalam'
              ? `${user.applyDataTemp.district}-ൽ സബ്ഡിസ്ട്രിക്റ്റുകളൊന്നും കണ്ടെത്തിയില്ല. ദയവായി മറ്റൊരു ജില്ല തിരഞ്ഞെടുക്കുക:\n` + DISTRICTS.map((d, i) => `${i + 1}. ${d}`).join('\n') + `\n0️⃣ റദ്ദാക്കുക`
              : `No subdistricts found in ${user.applyDataTemp.district}. Please select a different district:\n` + DISTRICTS.map((d, i) => `${i + 1}. ${d}`).join('\n') + `\n0️⃣ Cancel`;
            return sendMessage(From, msg);
          }
          const prompt = user.language === 'malayalam'
            ? `*സബ്ഡിസ്ട്രിക്ട് തിരഞ്ഞെടുക്കുക:* (0️⃣ റദ്ദാക്കുക, ജില്ലയിലേക്ക് മടങ്ങാൻ 'back')\n` + subs.map((s, i) => `${i + 1}. ${s}`).join('\n')
            : `*Select subdistrict:* (0️⃣ Cancel, 'back' to return to district selection)\n` + subs.map((s, i) => `${i + 1}. ${s}`).join('\n');
          return sendMessage(From, prompt);
        } catch (dbError) {
           logger.error(`DB Error fetching subdistricts for ${user.applyDataTemp.district}:`, dbError);
           await sendMessage(From, "Error fetching subdistricts. Please try again or type 0 to cancel.");
           // Consider reverting state or keeping it for retry? Reverting for now.
           user.applyState = 'district';
           await user.save();
           return;
        }
      }

      // STEP 3: Subdistrict selected → Prompt for Document Type
      if (user.applyState === 'subdistrict') {
         // Fetch subdistricts again to validate input against the correct list
         const subs = await CentreModel.distinct('subdistrict', { district: user.applyDataTemp.district });
         if (isNaN(num) || num < 1 || num > subs.length) {
             return sendMessage(From, user.language === 'malayalam'
                 ? `തെറ്റായ ഇൻപുട്ട്. ദയവായി 1–${subs.length} ഇടയിലുള്ള ഒരു നമ്പർ നൽകുക അല്ലെങ്കിൽ റദ്ദാക്കാൻ 0️⃣ നൽകുക.`
                 : `Invalid input. Please enter a number between 1–${subs.length}, or 0️⃣ to cancel.`);
         }
         user.applyDataTemp.subdistrict = subs[num - 1];
         user.applyState = 'document';
         await user.save();
         logger.info(`User ${user.phoneNumber} selected subdistrict: ${user.applyDataTemp.subdistrict}`);

         try {
             const services = await ServiceModel.find().sort({ name: 1 });
             if (!services.length) {
                // This indicates a system configuration issue
                logger.error("No services found in the database!");
                await sendMessage(From, "Sorry, no document services are configured currently. Please contact support.");
                return cancelAndGoToMainMenu(user, From);
             }
             const prompt = user.language === 'malayalam'
               ? `*അപേക്ഷിക്കാനുള്ള ഡോക്യുമെന്റ് തിരഞ്ഞെടുക്കുക:* (0️⃣ റദ്ദാക്കുക, സബ്ഡിസ്ട്രിക്റ്റിലേക്ക് മടങ്ങാൻ 'back')\n` + services.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
               : `*Select document to apply for:* (0️⃣ Cancel, 'back' to return to subdistrict selection)\n` + services.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
             return sendMessage(From, prompt);
         } catch (dbError) {
             logger.error("DB Error fetching services:", dbError);
             await sendMessage(From, "Error fetching document types. Please try again or type 0 to cancel.");
             user.applyState = 'subdistrict'; // Revert
             await user.save();
             return;
         }
      }

      // STEP 4: Document selected → Prompt for Centre
      if (user.applyState === 'document') {
         const services = await ServiceModel.find().sort({ name: 1 }); // Refetch to validate input
         if (isNaN(num) || num < 1 || num > services.length) {
             return sendMessage(From, user.language === 'malayalam'
                 ? `തെറ്റായ ഇൻപുട്ട്. ദയവായി 1–${services.length} ഇടയിലുള്ള ഒരു നമ്പർ നൽകുക അല്ലെങ്കിൽ റദ്ദാക്കാൻ 0️⃣ നൽകുക.`
                 : `Invalid input. Please enter a number between 1–${services.length}, or 0️⃣ to cancel.`);
         }
         const svc = services[num - 1];
         user.applyDataTemp.documentType = svc.key;
         user.applyDataTemp.documentName = svc.name;
         user.applyState = 'centre';
         await user.save();
         logger.info(`User ${user.phoneNumber} selected document: ${svc.name} (${svc.key})`);

         try {
             const centres = await CentreModel.find({
                 type: { $in: ['csc', 'akshaya'] }, // Ensure correct type matching
                 district: user.applyDataTemp.district,
                 subdistrict: user.applyDataTemp.subdistrict,
                 [`services.${svc.key}`]: true // Check if service key exists and is true
             }).limit(5); // Limit results for WhatsApp message length

             if (!centres.length) {
                 user.applyState = 'document'; // Revert state
                 await user.save();
                 logger.warn(`No centres found for service ${svc.key} in ${user.applyDataTemp.subdistrict}, ${user.applyDataTemp.district}`);
                 const msg = user.language === 'malayalam'
                     ? `❌ ഈ പ്രദേശത്ത് തിരഞ്ഞെടുത്ത ഡോക്യുമെന്റിനായി കേന്ദ്രങ്ങളൊന്നും ലഭ്യമല്ല. ദയവായി മറ്റൊരു ഡോക്യുമെന്റ് തിരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ റദ്ദാക്കാൻ 0️⃣ നൽകുക:\n` + services.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
                     : `❌ No centres found offering '${svc.name}' in this area. Please choose a different document or enter 0️⃣ to cancel:\n` + services.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
                 return sendMessage(From, msg);
             }

             user.applyDataTemp.centres = centres.map(c => ({
                 // Ensure correct field names from your CentreModel schema
                 centreId: c.centerId || c._id.toString(), // Use centerId if available, otherwise fallback to _id
                 centreName: c.centreName || 'N/A',
                 contact: c.contact || 'N/A',
                 address: `${c.addressLine1 || ''} ${c.subdistrict || ''}, ${c.district || ''}`.trim() || 'N/A'
             }));
             await user.save();

             const prompt = user.language === 'malayalam'
                 ? `*കേന്ദ്രം തിരഞ്ഞെടുക്കുക:* (0️⃣ റദ്ദാക്കുക, ഡോക്യുമെന്റിലേക്ക് മടങ്ങാൻ 'back')\n\n` +
                   user.applyDataTemp.centres.map((c, i) =>
                       `${i + 1}. ${c.centreName}\n📍 ${c.address}\n📞 ${c.contact || '-'}\n🆔 ${c.centreId}`
                   ).join('\n\n')
                 : `*Select service centre:* (0️⃣ Cancel, 'back' to return to document selection)\n\n` +
                   user.applyDataTemp.centres.map((c, i) =>
                       `${i + 1}. ${c.centreName}\n📍 ${c.address}\n📞 ${c.contact || '-'}\n🆔 ${c.centreId}`
                   ).join('\n\n');

             return sendMessage(From, prompt);
         } catch (dbError) {
             logger.error(`DB Error fetching centres for ${svc.key} in ${user.applyDataTemp.subdistrict}:`, dbError);
             await sendMessage(From, "Error fetching service centres. Please try again or type 0 to cancel.");
             user.applyState = 'document'; // Revert
             await user.save();
             return;
         }
      }

      // STEP 5: Centre selected → Create Service Request via API → Finish
      if (user.applyState === 'centre') {
          const list = user.applyDataTemp.centres || [];
          if (isNaN(num) || num < 1 || num > list.length) {
              return sendMessage(From, user.language === 'malayalam'
                  ? `തെറ്റായ ഇൻപുട്ട്. ദയവായി 1–${list.length} ഇടയിലുള്ള ഒരു നമ്പർ നൽകുക അല്ലെങ്കിൽ റദ്ദാക്കാൻ 0️⃣ നൽകുക.`
                  : `Invalid input. Please enter a number between 1–${list.length}, or 0️⃣ to cancel.`);
          }
          const chosen = list[num - 1];
          logger.info(`User ${user.phoneNumber} selected centre: ${chosen.centreName} (${chosen.centreId})`);

          try {
              const payload = {
                  "document-type": user.applyDataTemp.documentType,
                  "centre-id": chosen.centreId,
                  "mobile-number": user.phoneNumber // Ensure this is just the number, not whatsapp:+...
              };
              logger.info(`Sending service request payload: ${JSON.stringify(payload)}`);

              const { data } = await axios.post(
                  `${DOCUMENT_SERVICE_API_BASE}/service-request`,
                  payload,
                  { timeout: AXIOS_TIMEOUT }
              );

              logger.info(`Service request successful: ${JSON.stringify(data)}`);

              // Ensure data structure is as expected
              const requiredDocs = Array.isArray(data.requiredDocuments)
                 ? data.requiredDocuments.map(d => ({ name: d.name || 'Unknown Document', uploadedFile: d.uploadedFile || "" }))
                 : [];
              const uploadLink = data.uploadLink || '#'; // Provide a fallback

              // Persist application details in user record
              const newApplication = {
                  district: user.applyDataTemp.district,
                  subdistrict: user.applyDataTemp.subdistrict,
                  centreId: chosen.centreId,
                  centreName: chosen.centreName, // Store name for easier status display
                  documentType: user.applyDataTemp.documentType,
                  documentName: user.applyDataTemp.documentName, // Store name
                  serviceRequestId: data.serviceRequestId,
                  requiredDocuments: requiredDocs,
                  uploadLink: uploadLink,
                  status: 'initiated', // Initial status
                  createdAt: new Date() // Record creation time
              };
              user.applications.push(newApplication);

              // Teardown application flow state
              user.applyState = null;
              user.lastOption = null;
              user.applyDataTemp = {};
              await user.save();

              // Send confirmation message
              const confirmationMsg = user.language === 'malayalam'
                  ? `*${data.message || 'അഭ്യർത്ഥന വിജയകരമായി സമർപ്പിച്ചു.'}*\n` +
                    `അഭ്യർത്ഥന ഐഡി: ${data.serviceRequestId}\n` +
                    `ആവശ്യമുള്ള ഡോക്യുമെന്റുകൾ:\n${requiredDocs.map(d => `• ${d.name}`).join('\n')}` +
                    `\nഅപ്‌ലോഡ് ലിങ്ക്: ${uploadLink}` +
                    `\n\nഈ അഭ്യർത്ഥന റദ്ദാക്കാൻ എപ്പോൾ വേണമെങ്കിലും /cancel എന്ന് മറുപടി നൽകുക.`
                  : `*${data.message || 'Request submitted successfully.'}*\n` +
                    `Request ID: ${data.serviceRequestId}\n` +
                    `Required Documents:\n${requiredDocs.map(d => `• ${d.name}`).join('\n')}` +
                    `\nUpload Link: ${uploadLink}` +
                    `\n\nTo cancel this request at any time, reply with /cancel`;
              await sendMessage(From, confirmationMsg);

              // Start status polling
              pollStatus(data.serviceRequestId, From, user.language);

          } catch (err) {
              logger.error("API error creating service request:", err.response?.data || err.message);
              const errorMsg = user.language === 'malayalam'
                ? `അഭ്യർത്ഥന സൃഷ്ടിക്കുന്നതിൽ പിശക് (${err.response?.status || 'Network Error'}). ദയവായി വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ റദ്ദാക്കാൻ 0️⃣ നൽകുക.`
                : `Error creating request (${err.response?.status || 'Network Error'}). Please try again or enter 0️⃣ to cancel.`;
              await sendMessage(From, errorMsg);
              // Keep state as 'centre' to allow retry? Or revert? Reverting for simplicity.
              // user.applyState = 'centre'; await user.save(); // Option: Allow retry
          }
          return; // End of successful or failed API call step
      }

      // Fallback for unexpected state
      logger.warn(`User ${user.phoneNumber} reached unexpected applyState: ${user.applyState} with input: ${Body}`);
      const unexpectedStateMsg = user.language === 'malayalam'
         ? "പ്രതീക്ഷിക്കാത്ത நிலை. പുനരാരംഭിക്കാൻ 'hi' എന്ന് ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ റദ്ദാക്കാൻ 0️⃣ നൽകുക."
         : "Unexpected state. Type 'hi' to restart or 0️⃣ to cancel.";
      await sendMessage(From, unexpectedStateMsg);
      return cancelAndGoToMainMenu(user, From); // Go to main menu as a safe fallback
    }
  };
};