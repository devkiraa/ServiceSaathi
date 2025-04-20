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
      const text  = Body.trim();
      const lower = text.toLowerCase();
      const num   = parseInt(text, 10);

      // — SECTION 1: FULL CANCEL (0️⃣) —
      if (lower === '0') {
        user.applyState    = null;
        user.applyDataTemp = {};
        user.lastOption    = null;
        await user.save();
        return sendMessage(From,
          "*❌ Application cancelled.*\n1️⃣ Chat\n2️⃣ Apply for Document"
        );
      }

      // — SECTION 2: BACK —
      if (lower === 'back') {
        switch(user.applyState) {
          case 'subdistrict':
            user.applyState    = 'district';
            delete user.applyDataTemp.subdistrict;
            await user.save();
            return sendMessage(From,
              `*Select your district:* (0️⃣ Cancel)\n` +
              DISTRICTS.map((d,i)=>`${i+1}. ${d}`).join('\n')
            );
          case 'document':
            user.applyState    = 'subdistrict';
            delete user.applyDataTemp.documentKey;
            delete user.applyDataTemp.documentName;
            await user.save();
            {
              const subs = await CentreModel.distinct(
                'subdistrict',
                { district: user.applyDataTemp.district }
              );
              return sendMessage(From,
                `*Select subdistrict:* (0️⃣ Cancel, back to district)\n`+
                subs.map((s,i)=>`${i+1}. ${s}`).join('\n')
              );
            }
          case 'centre':
            user.applyState    = 'document';
            delete user.applyDataTemp.centres;
            await user.save();
            // we’ll re‑fetch services below
            break;
          default:
            user.applyState    = null;
            user.lastOption    = null;
            user.applyDataTemp = {};
            await user.save();
            return sendMessage(From,
              "*❌ Application cancelled.*\n1️⃣ Chat\n2️⃣ Apply for Document"
            );
        }
      }

      // — SECTION 3: FIRST ENTRY → district —
      if (!user.applyState) {
        user.applyState    = 'district';
        user.applyDataTemp = {};
        await user.save();
        return sendMessage(From,
          "*Select your district:* (0️⃣ Cancel)\n" +
          DISTRICTS.map((d,i)=>`${i+1}. ${d}`).join('\n')
        );
      }

      // — SECTION 4: district → subdistrict —
      if (user.applyState === 'district') {
        if (isNaN(num) || num<1||num> DISTRICTS.length) {
          return sendMessage(From, `Invalid. Enter 1–${DISTRICTS.length} or 0️⃣ to cancel.`);
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
            `No subdistricts in ${user.applyDataTemp.district}. Try again:\n`+
            DISTRICTS.map((d,i)=>`${i+1}. ${d}`).join('\n')+
            "\n0️⃣ Cancel"
          );
        }

        return sendMessage(From,
          `*Select subdistrict:* (0️⃣ Cancel, back to district)\n` +
          subs.map((s,i)=>`${i+1}. ${s}`).join('\n')
        );
      }

      // — SECTION 5: subdistrict → document list —
      if (user.applyState === 'subdistrict') {
        const subs = await CentreModel.distinct(
          'subdistrict',
          { district: user.applyDataTemp.district }
        );
        if (isNaN(num)||num<1||num>subs.length) {
          return sendMessage(From, `Invalid. Enter 1–${subs.length} or 0️⃣ to cancel.`);
        }
        user.applyDataTemp.subdistrict = subs[num-1];
        user.applyState               = 'document';
        await user.save();

        // **Dynamically load your services from Mongo**
        const services = await ServiceModel.find().sort({ name: 1 });
        return sendMessage(From,
          "*Select document to apply:* (0️⃣ Cancel, back to subdistrict)\n" +
          services.map((s,i)=>`${i+1}. ${s.name}`).join('\n')
        );
      }

      // — SECTION 6: document → centre list —
      if (user.applyState === 'document') {
        const services = await ServiceModel.find().sort({ name: 1 });
        if (isNaN(num)||num<1||num>services.length) {
          return sendMessage(From, `Invalid. Enter 1–${services.length} or 0️⃣ to cancel.`);
        }
        const svc = services[num-1];
        user.applyDataTemp.documentType = svc.key;
        user.applyDataTemp.documentName = svc.name;
        user.applyState                 = 'centre';
        await user.save();

        console.log("🔍 Searching centres for:", svc.key, user.applyDataTemp);

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
            `❌ No centres in this area.\nChoose another doc or 0️⃣ cancel:\n` +
            services.map((s,i)=>`${i+1}. ${s.name}`).join('\n')
          );
        }

        user.applyDataTemp.centres = centres.map(c=>({
          centreId:   c.centerId,
          centreName: c.centreName,
          contact:    c.contact,
          address:    `${c.district}, ${c.subdistrict}`
        }));
        await user.save();

        return sendMessage(From,
          "*Select centre:* (0️⃣ Cancel, back to document)\n" +
          user.applyDataTemp.centres.map((c,i)=>
            `${i+1}. ${c.centreName}\n📍${c.address}\n📞${c.contact}\n🆔 ${c.centreId}`
          ).join('\n\n')
        );
      }

      // — SECTION 7: centre → call API and persist —
      if (user.applyState === 'centre') {
        const list = user.applyDataTemp.centres || [];
        if (isNaN(num)||num<1||num>list.length) {
          return sendMessage(From, `Invalid. Enter 1–${list.length} or 0️⃣ cancel.`);
        }
        const chosen = list[num-1];
        try {
          const { data } = await axios.post(
            `${DOCUMENT_SERVICE_API_BASE}/service-request`,
            {
              "document-type": user.applyDataTemp.documentType,
              "centre-id":     chosen.centreId
            }
          );
          // push into user.applications, clear state/lastOption...
          user.applications.push({
            district:         user.applyDataTemp.district,
            subdistrict:      user.applyDataTemp.subdistrict,
            centreId:         chosen.centreId,
            documentType:     user.applyDataTemp.documentType,
            documentName:     user.applyDataTemp.documentName,
            serviceRequestId: data.serviceRequestId,
            requiredDocuments:data.requiredDocuments.map(d=>({name:d.name,uploadedFile:d.uploadedFile||""})),
            uploadLink:       data.uploadLink
          });
          user.applyState    = null;
          user.lastOption    = null;
          user.applyDataTemp = {};
          await user.save();

          return sendMessage(From,
            `*${data.message}*\n` +
            `Request ID: ${data.serviceRequestId}\n`+
            `Required Docs:\n`+
            data.requiredDocuments.map(d=>`• ${d.name}`).join('\n')+
            `\nUpload Link: ${data.uploadLink}`
          );
        } catch(err) {
          console.error("❌ API error:",err);
          return sendMessage(From, "Error. Try again later or 0️⃣ to cancel.");
        }
      }

      // — FINAL FALLBACK —
      return sendMessage(From, "Unexpected state. Type 'hi' to restart or 0️⃣ to cancel.");
    }
  };
};
