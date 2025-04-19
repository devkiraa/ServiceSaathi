// controllers/modules/applyModule.js
const axios       = require('axios');
const CentreModel = require('../../models/Centre');
const ServiceModel = require('../../models/Service');


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

      // ──────────────────────────────────────────────────────────────────────────
      // SECTION 1: CANCEL (0️⃣) → Reset everything, clear lastOption + applyState.
      // ──────────────────────────────────────────────────────────────────────────
      if (lower === '0') {
        user.applyState     = null;
        user.applyDataTemp  = {};
        user.lastOption     = null;         // clear mode so menu will be shown next
        await user.save();
        return sendMessage(From,
          "*❌ Application cancelled.*\n" +
          "*Please choose:*\n1️⃣ Chat\n2️⃣ Apply for Document"
        );
      }

      // ──────────────────────────────────────────────────────────────────────────
      // SECTION 2: BACK → Step one level up, preserve lastOption = 'apply'
      // ──────────────────────────────────────────────────────────────────────────
      if (lower === 'back') {
        switch (user.applyState) {
          case 'subdistrict':
            // back to district selection
            user.applyState    = 'district';
            delete user.applyDataTemp.subdistrict;
            await user.save();
            return sendMessage(From,
              `*Select your district:* (0️⃣ Cancel)\n` +
              DISTRICTS.map((d,i) => `${i+1}. ${d}`).join('\n')
            );
          case 'document':
            // back to subdistrict selection
            user.applyState    = 'subdistrict';
            delete user.applyDataTemp.documentType;
            delete user.applyDataTemp.documentName;
            await user.save();
            {
              const subs = await CentreModel.distinct(
                'subdistrict', 
                { district: user.applyDataTemp.district }
              );
              return sendMessage(From,
                `*Select subdistrict in ${user.applyDataTemp.district}:* (0️⃣ Cancel, type 'back' to district)\n` +
                subs.map((s,i) => `${i+1}. ${s}`).join('\n')
              );
            }
          case 'centre':
            // back to document selection
            user.applyState    = 'document';
            delete user.applyDataTemp.centres;
            await user.save();
            return sendMessage(From,
              "*Select document to apply:* (0️⃣ Cancel, type 'back' to subdistrict)\n" +
              DOCUMENT_TYPES.map((d,i) => `${i+1}. ${d.name}`).join('\n')
            );
          default:
            // nothing to go back to: treat as full cancel
            user.applyState     = null;
            user.applyDataTemp  = {};
            user.lastOption     = null;
            await user.save();
            return sendMessage(From,
              "*❌ Application cancelled.*\n" +
              "*Please choose:*\n1️⃣ Chat\n2️⃣ Apply for Document"
            );
        }
      }

      // ──────────────────────────────────────────────────────────────────────────
      // SECTION 3: INITIAL PROMPT → Begin at district if no state set
      // ──────────────────────────────────────────────────────────────────────────
      if (user.applyState === 'document') {
        const services = await ServiceModel.find().sort({ name: 1 }); // Optional sort by name
        if (isNaN(num) || num < 1 || num > services.length) {
          return sendMessage(From,
            `Invalid choice. Enter 1–${services.length} or 0️⃣ to cancel.`
          );
        }
        const selectedService = services[num - 1];
        user.applyDataTemp.documentType = selectedService.key;
        user.applyDataTemp.documentName = selectedService.name;
        user.applyState = 'centre';
        await user.save();
      
        const centres = await CentreModel.find({
          type: { $in: ['csc', 'akshaya'] },
          district: user.applyDataTemp.district,
          subdistrict: user.applyDataTemp.subdistrict,
          [`services.${selectedService.key}`]: true
        }).limit(5);
      
        if (!centres.length) {
          user.applyState = 'document';
          await user.save();
          return sendMessage(From,
            "❌ No centres offer that service here.\nChoose another document or 0️⃣ to cancel:\n" +
            services.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
          );
        }
      
        user.applyDataTemp.centres = centres.map(c => ({
          centreId: c.centerId || "N/A",
          centreName: c.centreName,
          contact: c.contact,
          address: `${c.district}, ${c.subdistrict}`
        }));
        await user.save();
      
        return sendMessage(From,
          "*Select centre:* (Enter number, 0️⃣ Cancel, 'back' to document)\n" +
          user.applyDataTemp.centres.map((c, i) =>
            `${i + 1}. *${c.centreName}*\n📍 ${c.address}\n📞 ${c.contact}\n🆔 ${c.centreId}`
          ).join('\n\n')
        );
      }
   
      // ──────────────────────────────────────────────────────────────────────────
      // SECTION 4: DISTRICT SELECTED → Move to subdistrict
      // ──────────────────────────────────────────────────────────────────────────
      if (user.applyState === 'district') {
        if (isNaN(num) || num < 1 || num > DISTRICTS.length) {
          return sendMessage(From,
            `Invalid district. Enter 1–${DISTRICTS.length} or 0️⃣ to cancel.`
          );
        }
        user.applyDataTemp.district = DISTRICTS[num-1];
        user.applyState             = 'subdistrict';
        await user.save();

        const subs = await CentreModel.distinct(
          'subdistrict',
          { district: user.applyDataTemp.district }
        );
        if (!subs.length) {
          // revert if none
          user.applyState = 'district';
          await user.save();
          return sendMessage(From,
            `No subdistricts in ${user.applyDataTemp.district}. Try again:\n` +
            DISTRICTS.map((d,i) => `${i+1}. ${d}`).join('\n') +
            "\n0️⃣ Cancel"
          );
        }
        return sendMessage(From,
          `*Select subdistrict in ${user.applyDataTemp.district}:* (Enter number, 0️⃣ Cancel, 'back' to district)\n` +
          subs.map((s,i) => `${i+1}. ${s}`).join('\n')
        );
      }

      // ──────────────────────────────────────────────────────────────────────────
      // SECTION 5: SUBDISTRICT SELECTED → Move to document list
      // ──────────────────────────────────────────────────────────────────────────
      const services = await ServiceModel.find().sort({ name: 1 });
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
        user.applyState               = 'document';
        await user.save();
        return sendMessage(From,
          "*Select document to apply:* (Enter number, 0️⃣ Cancel, 'back' to subdistrict)\n" +
          services.map((s, i) => `${i + 1}. ${s.name}`).join('\n')
        );
      }

      // ──────────────────────────────────────────────────────────────────────────
      // SECTION 6: DOCUMENT SELECTED → Find centres offering it
      // ──────────────────────────────────────────────────────────────────────────
      if (user.applyState === 'document') {
        if (isNaN(num) || num < 1 || num > DOCUMENT_TYPES.length) {
          return sendMessage(From,
            `Invalid choice. Enter 1–${DOCUMENT_TYPES.length} or 0️⃣ to cancel.`
          );
        }
        const doc = DOCUMENT_TYPES[num-1];
        user.applyDataTemp.documentType = doc.key;
        user.applyDataTemp.documentName = doc.name;
        user.applyState                 = 'centre';
        await user.save();

        console.log("🔍 Searching centres:", user.applyDataTemp);

        const centres = await CentreModel.find({
          type:        { $in: ['csc','akshaya'] },
          district:    user.applyDataTemp.district,
          subdistrict: user.applyDataTemp.subdistrict,
          [`services.${doc.key}`]: true
        }).limit(5);

        if (!centres.length) {
          user.applyState = 'document';
          await user.save();
          return sendMessage(From,
            "❌ No centres offer that service here.\nChoose another document or 0️⃣ to cancel:\n" +
            DOCUMENT_TYPES.map((d,i) => `${i+1}. ${d.name}`).join('\n')
          );
        }

        user.applyDataTemp.centres = centres.map(c => ({
          centreId:   c.centerId || "N/A",
          centreName: c.centreName,
          contact:    c.contact,
          address:    `${c.district}, ${c.subdistrict}`
        }));
        await user.save();

        return sendMessage(From,
          "*Select centre:* (Enter number, 0️⃣ Cancel, 'back' to document)\n" +
          user.applyDataTemp.centres.map((c,i) => 
            `${i+1}. *${c.centreName}*\n📍 ${c.address}\n📞 ${c.contact}\n🆔 ${c.centreId}`
          ).join('\n\n')
        );
      }

      // ──────────────────────────────────────────────────────────────────────────
      // SECTION 7: CENTRE SELECTED → Call the Document‑API & Persist result
      // ──────────────────────────────────────────────────────────────────────────
      if (user.applyState === 'centre') {
        const list = user.applyDataTemp.centres || [];
        if (isNaN(num) || num < 1 || num > list.length) {
          return sendMessage(From,
            `Invalid choice. Enter 1–${list.length} or 0️⃣ to cancel.`
          );
        }
        const chosen = list[num-1];

        try {
          const apiRes = await axios.post(
            `${DOCUMENT_SERVICE_API_BASE}/api/service-request`,
            {
              "document-type": user.applyDataTemp.documentName,
              "centre-id":     chosen.centreId
            }
          );
          const data = apiRes.data;

          // add to user.applications
          user.applications.push({
            district:         user.applyDataTemp.district,
            subdistrict:      user.applyDataTemp.subdistrict,
            centreId:         chosen.centreId,
            documentType:     user.applyDataTemp.documentType,
            documentName:     user.applyDataTemp.documentName,
            serviceRequestId: data.serviceRequestId,
            requiredDocuments:data.requiredDocuments.map(d=>({
              name: d.name,
              uploadedFile: d.uploadedFile||""
            })),
            uploadLink:       data.uploadLink
          });

          // reset state & lastOption so next input goes to menu
          user.applyState    = null;
          user.lastOption    = null;
          user.applyDataTemp = {};
          await user.save();

          return sendMessage(From,
            `*${data.message}*\n` +
            `Request ID: ${data.serviceRequestId}\n` +
            `Required Docs:\n` +
            data.requiredDocuments.map(d=>`• ${d.name}`).join('\n') +
            `\nUpload Link: ${data.uploadLink}`
          );
        } catch (err) {
          console.error("❌ Document API error:", err);
          return sendMessage(From,
            "Error creating request. Try again later or 0️⃣ to cancel."
          );
        }
      }

      // ──────────────────────────────────────────────────────────────────────────
      // SECTION 8: FINAL FALLBACK
      // ──────────────────────────────────────────────────────────────────────────
      return sendMessage(From,
        "Unexpected state. Type 'hi' to restart or 0️⃣ to cancel."
      );
    }
  };
};
