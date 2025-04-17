// controllers/modules/applyModule.js

const axios = require('axios');
const CentreModel = require('../../models/Centre');
const UserModel   = require('../../models/wha-user');

const DOCUMENT_TYPES = [
  { key: 'income_certificate',     name: 'Income Certificate'    },
  { key: 'voter_registration',     name: 'Voter Registration'    },
  { key: 'passport_service',       name: 'Passport Service'      },
  { key: 'utility_payments',       name: 'Utility Payments'      },
  { key: 'possession_certificate', name: 'Possession Certificate'}
];

const DISTRICTS = [
  "Thiruvananthapuram","Kollam","Pathanamthitta","Alappuzha",
  "Kottayam","Idukki","Ernakulam","Thrissur",
  "Palakkad","Malappuram","Kozhikode","Wayanad",
  "Kannur","Kasaragod"
];

module.exports = function(sendMessage, DOCUMENT_SERVICE_API_BASE) {
  return {
    process: async (Body, user, From) => {
      const text  = Body.trim();
      const lower = text.toLowerCase();
      const num   = parseInt(text, 10);

      // ===========================================================================
      // 1. Check for a full cancel command ("0")
      //    This resets the application completely.
      // ===========================================================================
      if (lower === '0') {
        user.applyState = null;
        user.applyDataTemp = {};
        await user.save();
        return sendMessage(From,
          "*❌ Application cancelled.*\n" +
          "0️⃣ Cancel\n1️⃣ Chat\n2️⃣ Apply for Document"
        );
      }

      // ===========================================================================
      // 2. Check for "back" command to go one step backward in the application.
      // ===========================================================================
      if (lower === 'back') {
        switch (user.applyState) {
          case 'subdistrict':
            // Go back to district selection.
            user.applyState = 'district';
            await user.save();
            return sendMessage(From,
              "*Select your district:* (0️⃣ Cancel)\n" +
              DISTRICTS.map((d, i) => `${i+1}. ${d}`).join('\n')
            );
          case 'document':
            // Go back to subdistrict selection.
            user.applyState = 'subdistrict';
            await user.save();
            {
              const subs = await CentreModel.distinct(
                'subdistrict',
                { district: user.applyDataTemp.district }
              );
              return sendMessage(From,
                `*Select subdistrict in ${user.applyDataTemp.district}:* (Enter the number, 0️⃣ Cancel)\n` +
                subs.map((s, i) => `${i+1}. ${s}`).join('\n')
              );
            }
          case 'centre':
            // Go back to document selection.
            user.applyState = 'document';
            await user.save();
            return sendMessage(From,
              "*Select document to apply:* (Enter the number, 0️⃣ Cancel or type 'back' to return to subdistrict)\n" +
              DOCUMENT_TYPES.map((d, i) => `${i+1}. ${d.name}`).join('\n')
            );
          default:
            // No state to go back from; treat as full cancel.
            user.applyState = null;
            user.applyDataTemp = {};
            await user.save();
            return sendMessage(From,
              "*❌ Application cancelled.*\n" +
              "0️⃣ Cancel\n1️⃣ Chat\n2️⃣ Apply for Document"
            );
        }
      }

      // ===========================================================================
      // 3. Proceed with the application process based on the current step.
      // ===========================================================================

      // Step 0: If no state is set yet, start with district selection.
      if (!user.applyState) {
        user.applyState = 'district';
        user.applyDataTemp = {};
        await user.save();
        return sendMessage(From,
          "*Select your district:* (Enter the number, 0️⃣ Cancel)\n" +
          DISTRICTS.map((d, i) => `${i+1}. ${d}`).join('\n')
        );
      }

      // Step 1: District selection.
      if (user.applyState === 'district') {
        if (isNaN(num) || num < 1 || num > DISTRICTS.length) {
          return sendMessage(From,
            `Invalid district. Enter 1–${DISTRICTS.length} or 0️⃣ to cancel.`
          );
        }
        user.applyDataTemp.district = DISTRICTS[num-1];
        user.applyState = 'subdistrict';
        await user.save();

        // Fetch available subdistricts.
        const subs = await CentreModel.distinct(
          'subdistrict',
          { district: user.applyDataTemp.district }
        );
        if (!subs.length) {
          // If none found, revert to district selection.
          user.applyState = 'district';
          await user.save();
          return sendMessage(From,
            `No subdistricts found for ${user.applyDataTemp.district}. Try another district:\n` +
            DISTRICTS.map((d, i) => `${i+1}. ${d}`).join('\n') +
            "\n0️⃣ Cancel"
          );
        }
        return sendMessage(From,
          `*Select subdistrict in ${user.applyDataTemp.district}:* (Enter the number, 0️⃣ Cancel, 'back' to reselect district)\n` +
          subs.map((s, i) => `${i+1}. ${s}`).join('\n')
        );
      }

      // Step 2: Subdistrict selection.
      if (user.applyState === 'subdistrict') {
        const subs = await CentreModel.distinct(
          'subdistrict',
          { district: user.applyDataTemp.district }
        );
        if (isNaN(num) || num < 1 || num > subs.length) {
          return sendMessage(From,
            `Invalid subdistrict. Enter 1–${subs.length} or 0️⃣ to cancel.`
          );
        }
        user.applyDataTemp.subdistrict = subs[num-1];
        user.applyState = 'document';
        await user.save();
        return sendMessage(From,
          "*Select document to apply:* (Enter the number, 0️⃣ Cancel, 'back' to reselect subdistrict)\n" +
          DOCUMENT_TYPES.map((d, i) => `${i+1}. ${d.name}`).join('\n')
        );
      }

      // Step 3: Document selection.
      if (user.applyState === 'document') {
        if (isNaN(num) || num < 1 || num > DOCUMENT_TYPES.length) {
          return sendMessage(From,
            `Invalid choice. Enter 1–${DOCUMENT_TYPES.length} or 0️⃣ to cancel.`
          );
        }
        const doc = DOCUMENT_TYPES[num-1];
        user.applyDataTemp.documentType = doc.key;
        user.applyDataTemp.documentName = doc.name;
        user.applyState = 'centre';
        await user.save();

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
        }).limit(5);

        if (!centres.length) {
          // If no centres found, allow the user to reselect document.
          user.applyState = 'document';
          await user.save();
          return sendMessage(From,
            "❌ No centres offer that service in this area.\nChoose another document or 0️⃣ to cancel.\n" +
            DOCUMENT_TYPES.map((d, i) => `${i+1}. ${d.name}`).join('\n')
          );
        }
        user.applyDataTemp.centres = centres.map(c => ({
          centreId:   c.centerId || "N/A",
          centreName: c.centreName || "Unnamed Centre",
          contact:    c.contact || "No contact info",
          address:    `${c.district || "Unknown District"}, ${c.subdistrict || "Unknown Subdistrict"}`
        }));
        await user.save();

        return sendMessage(From,
          "*Select centre:* (Enter the number, 0️⃣ Cancel, 'back' to reselect document)\n" +
          user.applyDataTemp.centres.map((c, i) =>
            `${i+1}. *${c.centreName}*\n📍 ${c.address}\n📞 ${c.contact}\n🆔 ${c.centreId}`
          ).join('\n\n')
        );
      }

      // Step 4: Centre selection and create request.
if (user.applyState === 'centre') {
  const list = user.applyDataTemp.centres || [];
  if (isNaN(num) || num < 1 || num > list.length) {
    return sendMessage(From,
      `Invalid choice. Enter 1–${list.length} or 0️⃣ to cancel.`
    );
  }
  const chosen = list[num-1];
  try {
    // Construct the URL using DOCUMENT_SERVICE_API_BASE
    const apiUrl = `${DOCUMENT_SERVICE_API_BASE}/service-request`;
    
    // Make the API request with the expected payload.
    const apiRes = await axios.post(apiUrl, {
      "document-type": user.applyDataTemp.documentType,  // e.g., "Income Certificate"
      "centre-id":     chosen.centreId                     // e.g., "689691"
    });
    const data = apiRes.data;  // The sample response is assumed to match the provided structure.

    // Save the application data to the user's record.
    user.applications.push({
      district:          user.applyDataTemp.district,
      subdistrict:       user.applyDataTemp.subdistrict,
      centreId:          chosen.centreId,
      documentType:      user.applyDataTemp.documentType,
      documentName:      user.applyDataTemp.documentName,
      serviceRequestId:  data.serviceRequestId,
      requiredDocuments: data.requiredDocuments.map(d => ({
        name: d.name,
        uploadedFile: d.uploadedFile || ""
      })),
      uploadLink:        data.uploadLink  // The full upload link from the response.
    });
    // Clear the temporary state upon successful creation.
    user.applyState = null;
    user.applyDataTemp = {};
    await user.save();

    return sendMessage(From,
      `*${data.message}*\n` +
      `Request ID: ${data.serviceRequestId}\n` +
      `Required Docs:\n` +
      data.requiredDocuments.map(d => `• ${d.name}`).join('\n') +
      `\nUpload Link: ${data.uploadLink}`  // Send the full link to the user.
    );
  } catch (err) {
    console.error("❌ Service‑request API error:", err);
    return sendMessage(From,
      "Error creating request. Please try again later or 0️⃣ to cancel."
    );
  }
}


      // Final fallback for any unexpected state.
      return sendMessage(From,
        "Unexpected state. Type 'hi' to restart or 0️⃣ to cancel."
      );
    }
  };
};
