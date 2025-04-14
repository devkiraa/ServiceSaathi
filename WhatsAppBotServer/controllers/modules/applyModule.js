// controllers/modules/applyModule.js
const axios       = require('axios');
const CentreModel = require('../../models/Centre');
const UserModel   = require('../../models/wha-user');

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

module.exports = function(sendMessage, DOCUMENT_SERVICE_API_BASE) {
  return {
    process: async (Body, user, From) => {
      const text  = Body.trim();
      const lower = text.toLowerCase();
      const num   = parseInt(text, 10);

      // ─── Cancel / Back ─────────────────────────────────────
      if (lower === '0' || lower === 'back') {
        user.applyState    = null;
        user.applyDataTemp = {};
        await user.save();
        return sendMessage(From,
          "*❌ Application cancelled.*\n0️⃣ Cancel\n1️⃣ Chat\n2️⃣ Apply for Document"
        );
      }

      // ─── STEP 0: District ───────────────────────────────────
      if (!user.applyState) {
        user.applyState    = 'district';
        user.applyDataTemp = {};
        await user.save();
        return sendMessage(From,
          "*Select your district:* (0️⃣ Cancel)\n" +
          DISTRICTS.map((d,i) => `${i+1}. ${d}`).join('\n')
        );
      }

      // ─── STEP 1: District → Subdistrict ────────────────────
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
          user.applyState = 'district';
          await user.save();
          return sendMessage(From,
            `No subdistricts in ${user.applyDataTemp.district}. Try again:\n` +
            DISTRICTS.map((d,i) => `${i+1}. ${d}`).join('\n') +
            "\n0️⃣ Cancel"
          );
        }
        return sendMessage(From,
          `*Select subdistrict in ${user.applyDataTemp.district}:* (0️⃣ Cancel)\n` +
          subs.map((s,i) => `${i+1}. ${s}`).join('\n')
        );
      }

      // ─── STEP 2: Subdistrict → Document ────────────────────
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
          "*Select document to apply:* (0️⃣ Cancel)\n" +
          DOCUMENT_TYPES.map((d,i) => `${i+1}. ${d.name}`).join('\n')
        );
      }

      // ─── STEP 3: Document → Centre list ────────────────────
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

        console.log("🔍 Searching centres:", {
          district:    user.applyDataTemp.district,
          subdistrict: user.applyDataTemp.subdistrict,
          service:     doc.key
        });

        const centres = await CentreModel.find({
          type:        { $in: ['csc','akshaya'] },
          district:    user.applyDataTemp.district,
          subdistrict: user.applyDataTemp.subdistrict,
          [`services.${doc.key}`]: true
        }).limit(5);

        console.log("🏥 Centres found:", centres.length);

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
          centreName: c.centreName || "Unnamed Centre",
          contact:    c.contact || "No contact info",
          address:    `${c.district || "Unknown District"}, ${c.subdistrict || "Unknown Subdistrict"}`
        }));
        await user.save();
        
        return sendMessage(From,
          "*Select centre:* (0️⃣ Cancel)\n" +
          user.applyDataTemp.centres.map((c, i) =>
            `${i+1}. *${c.centreName}*\n📍 ${c.address}\n📞 ${c.contact}\n🆔 ${c.centreId}`
          ).join('\n\n')
        );        
      }

      // ─── STEP 4: Centre → Create Request ───────────────────
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

          user.applications.push({
            district:         user.applyDataTemp.district,
            subdistrict:      user.applyDataTemp.subdistrict,
            centreId:         chosen.centreId,
            documentType:     user.applyDataTemp.documentType,
            documentName:     user.applyDataTemp.documentName,
            serviceRequestId: data.serviceRequestId,
            requiredDocuments:data.requiredDocuments.map(d=>({
              name: d.name, uploadedFile: d.uploadedFile || ""
            })),
            uploadLink:       data.uploadLink
          });
          user.applyState    = null;
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
          console.error("❌ Service‑request API error:", err);
          return sendMessage(From,
            "Error creating request. Please try again later or 0️⃣ to cancel."
          );
        }
      }

      // ─── Final fallback ─────────────────────────────────────
      return sendMessage(From,
        "Unexpected state. Type 'hi' to restart or 0️⃣ to cancel."
      );
    }
  };
};
