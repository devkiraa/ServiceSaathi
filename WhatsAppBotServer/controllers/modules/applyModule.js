// controllers/modules/applyModule.js
const axios        = require('axios');
const CentreModel  = require('../../models/Centre');
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
      const lower = Body.trim().toLowerCase();
      const num   = parseInt(Body, 10);

      // — HELPER: re‑send top‑level menu in the user’s language
      function sendMainMenu() {
        if (user.language === 'malayalam') {
          return sendMessage(From,
            "*ഹലോ!* ദയവായി തിരഞ്ഞെടുക്കുക:\n" +
            "1️⃣ Chat\n2️⃣ Apply for Document\n" +
            "_(ഭാഷ മാറ്റാൻ /LANG)_"
          );
        }
        return sendMessage(From,
          "*Hello!* Please choose:\n" +
          "1️⃣ Chat\n2️⃣ Apply for Document\n" +
          "_(To change language, send /LANG)_"
        );
      }

      // 0️⃣ Full cancel — tear down everything, then main menu
      if (lower === '0') {
        delete user.applyState;
        user.applyDataTemp = {};
        user.lastOption    = null;
        await user.save();
        return sendMainMenu();
      }

      // 🔙 Back — step one level up
      if (lower === 'back') {
        switch (user.applyState) {
          case 'subdistrict':
            user.applyState = 'district';
            delete user.applyDataTemp.subdistrict;
            await user.save();
            return sendMessage(From,
              `*Select district:* (0️⃣ Cancel)\n` +
              DISTRICTS.map((d,i)=>`${i+1}. ${d}`).join('\n')
            );
          case 'document':
            user.applyState = 'subdistrict';
            delete user.applyDataTemp.documentType;
            delete user.applyDataTemp.documentName;
            await user.save();
            {
              const subs = await CentreModel.distinct(
                'subdistrict',
                { district: user.applyDataTemp.district }
              );
              return sendMessage(From,
                `*Select subdistrict:* (0️⃣ Cancel, back to district)\n` +
                subs.map((s,i)=>`${i+1}. ${s}`).join('\n')
              );
            }
          case 'centre':
            user.applyState = 'document';
            delete user.applyDataTemp.centres;
            await user.save();
            // fall through to document prompt below
            break;
          default:
            // nothing to go back to — cancel
            delete user.applyState;
            user.applyDataTemp = {};
            user.lastOption    = null;
            await user.save();
            return sendMainMenu();
        }
      }

      // ▶️ STEP 1: start at district
      if (!user.applyState) {
        user.applyState    = 'district';
        user.applyDataTemp = {};
        await user.save();
        return sendMessage(From,
          `*Select district:* (0️⃣ Cancel)\n` +
          DISTRICTS.map((d,i)=>`${i+1}. ${d}`).join('\n')
        );
      }

      // 🗺️ STEP 2: district → subdistrict
      if (user.applyState === 'district') {
        if (isNaN(num) || num < 1 || num > DISTRICTS.length) {
          return sendMessage(From,
            `Invalid. Enter 1–${DISTRICTS.length} or 0️⃣ to cancel.`
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
          user.applyState = 'district';
          await user.save();
          return sendMessage(From,
            `No subdistricts in ${user.applyDataTemp.district}. Try again:\n` +
            DISTRICTS.map((d,i)=>`${i+1}. ${d}`).join('\n') +
            `\n0️⃣ Cancel`
          );
        }
        return sendMessage(From,
          `*Select subdistrict:* (0️⃣ Cancel, back to district)\n` +
          subs.map((s,i)=>`${i+1}. ${s}`).join('\n')
        );
      }

      // 📄 STEP 3: subdistrict → document list
      if (user.applyState === 'subdistrict') {
        const subs = await CentreModel.distinct(
          'subdistrict',
          { district: user.applyDataTemp.district }
        );
        if (isNaN(num) || num < 1 || num > subs.length) {
          return sendMessage(From,
            `Invalid. Enter 1–${subs.length} or 0️⃣ to cancel.`
          );
        }
        user.applyDataTemp.subdistrict = subs[num-1];
        user.applyState               = 'document';
        await user.save();

        const services = await ServiceModel.find().sort({ name: 1 });
        return sendMessage(From,
          `*Select document to apply:* (0️⃣ Cancel, back to subdistrict)\n` +
          services.map((s,i)=>`${i+1}. ${s.name}`).join('\n')
        );
      }

      // 🏥 STEP 4: document → centre list
      if (user.applyState === 'document') {
        const services = await ServiceModel.find().sort({ name: 1 });
        if (isNaN(num) || num < 1 || num > services.length) {
          return sendMessage(From,
            `Invalid. Enter 1–${services.length} or 0️⃣ to cancel.`
          );
        }
        const svc = services[num-1];
        user.applyDataTemp.documentType = svc.key;
        user.applyDataTemp.documentName = svc.name;
        user.applyState                 = 'centre';
        await user.save();

        const centres = await CentreModel.find({
          type:        { $in: ['csc','akshaya'] },
          district:    user.applyDataTemp.district,
          subdistrict: user.applyDataTemp.subdistrict,
          [`services.${svc.key}`]: true
        }).limit(5);

        if (!centres.length) {
          user.applyState = 'document';
          await user.save();
          return sendMessage(From,
            `❌ No centres here. Choose another doc or 0️⃣ to cancel:\n` +
            services.map((s,i)=>`${i+1}. ${s.name}`).join('\n')
          );
        }

        user.applyDataTemp.centres = centres.map(c => ({
          centreId:   c.centerId,
          centreName: c.centreName,
          contact:    c.contact,
          address:    `${c.subdistrict}, ${c.district}`
        }));
        await user.save();

        return sendMessage(From,
          `*Select centre:* (0️⃣ Cancel, back to document)\n` +
          user.applyDataTemp.centres.map((c,i)=>
            `${i+1}. ${c.centreName}\n📍 ${c.address}\n📞 ${c.contact}\n🆔 ${c.centreId}`
          ).join('\n\n')
        );
      }

      // 📝 STEP 5: centre → API → persist → teardown
      if (user.applyState === 'centre') {
        const list = user.applyDataTemp.centres || [];
        if (isNaN(num) || num < 1 || num > list.length) {
          return sendMessage(From,
            `Invalid. Enter 1–${list.length} or 0️⃣ to cancel.`
          );
        }
        const chosen = list[num-1];
        try {
          // Include mobile-number in the service request payload
          const { data } = await axios.post(
            `${DOCUMENT_SERVICE_API_BASE}/service-request`,
            {
              "document-type":   user.applyDataTemp.documentType,
              "centre-id":       chosen.centreId,
              "mobile-number":   user.phoneNumber
            }
          );
          // persist
          user.applications.push({
            district:         user.applyDataTemp.district,
            subdistrict:      user.applyDataTemp.subdistrict,
            centreId:         chosen.centreId,
            documentType:     user.applyDataTemp.documentType,
            documentName:     user.applyDataTemp.documentName,
            serviceRequestId: data.serviceRequestId,
            requiredDocuments: data.requiredDocuments.map(d=>({
              name: d.name,
              uploadedFile: d.uploadedFile || ""
            })),
            uploadLink:       data.uploadLink
          });
          // teardown
          delete user.applyState;
          user.lastOption    = null;
          user.applyDataTemp = {};
          await user.save();

          return sendMessage(From,
            `*${data.message}*\n` +
            `Request ID: ${data.serviceRequestId}\n` +
            `Required Docs:\n${data.requiredDocuments.map(d=>`• ${d.name}`).join('\n')}` +
            `\nUpload: ${data.uploadLink}`
          );
        } catch (err) {
          console.error("❌ API error:", err.response?.data || err.message);
          return sendMessage(From,
            "Error creating request. Try again later or 0️⃣ to cancel."
          );
        }
      }

      // 🔚 Fallback
      return sendMessage(From,
        "Unexpected state. Type 'hi' to restart or 0️⃣ to cancel."
      );
    }
  };
};
