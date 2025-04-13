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

module.exports = function(sendMessage, CHAT_API_BASE) {
  return {
    process: async (Body, user, From) => {
      const text  = Body.trim();
      const lower = text.toLowerCase();
      const num   = parseInt(text, 10);

      // Handle "back"/"0" to step backwards
      if (lower === '0' || lower === 'back') {
        switch(user.applyState) {
          case 'subdistrict':
            user.applyState = 'district';
            user.applyDataTemp = {};
            await user.save();
            // fall through to district prompt
          case 'district':
            // If we just reset or were at district, exit apply flow
            user.applyState = null;
            user.applyDataTemp = {};
            await user.save();
            return sendMessage(From, "*Returning to main menu.*\n1️⃣ Chat\n2️⃣ Apply for Document");
          case 'document':
            user.applyState = 'subdistrict';
            await user.save();
            // re-prompt subdistrict
            {
              const subs = await CentreModel.distinct(
                'subdistrict',
                { district: user.applyDataTemp.district }
              );
              const msg = `*Select subdistrict in ${user.applyDataTemp.district}:*\n` +
                subs.map((s,i) => `${i+1}. ${s}`).join('\n');
              return sendMessage(From, msg);
            }
          case 'centre':
            user.applyState = 'document';
            await user.save();
            // re-prompt document types
            return sendMessage(From,
              "*Select document to apply:*\n" +
              DOCUMENT_TYPES.map((d,i) => `${i+1}. ${d.name}`).join('\n')
            );
          default:
            // not in apply flow
            return sendMessage(From, "*Returning to main menu.*\n1️⃣ Chat\n2️⃣ Apply for Document");
        }
      }

      // STEP 0: Prompt District
      if (!user.applyState) {
        user.applyState = 'district';
        user.applyDataTemp = {};
        await user.save();

        return sendMessage(From,
          "*Select your district:*\n" +
          DISTRICTS.map((d,i) => `${i+1}. ${d}`).join('\n')
        );
      }

      // STEP 1: District → Subdistrict
      if (user.applyState === 'district') {
        const idx = num - 1;
        if (isNaN(idx) || idx < 0 || idx >= DISTRICTS.length) {
          return sendMessage(From, "Invalid district. Enter a number between 1 and 14.");
        }
        user.applyDataTemp.district = DISTRICTS[idx];
        user.applyState = 'subdistrict';
        await user.save();

        const subs = await CentreModel.distinct(
          'subdistrict',
          { district: user.applyDataTemp.district }
        );
        if (!subs.length) {
          // no subdistricts: reset to district
          user.applyState = 'district';
          await user.save();
          return sendMessage(From, `No subdistricts found. Select district again:\n` +
            DISTRICTS.map((d,i) => `${i+1}. ${d}`).join('\n')
          );
        }

        return sendMessage(From,
          `*Select subdistrict in ${user.applyDataTemp.district}:*\n` +
          subs.map((s,i) => `${i+1}. ${s}`).join('\n')
        );
      }

      // STEP 2: Subdistrict → Document Type
      if (user.applyState === 'subdistrict') {
        const subs = await CentreModel.distinct(
          'subdistrict',
          { district: user.applyDataTemp.district }
        );
        const idx = num - 1;
        if (isNaN(idx) || idx < 0 || idx >= subs.length) {
          return sendMessage(From, `Invalid subdistrict. Enter 1–${subs.length}.`);
        }
        user.applyDataTemp.subdistrict = subs[idx];
        user.applyState = 'document';
        await user.save();

        return sendMessage(From,
          "*Select document to apply:*\n" +
          DOCUMENT_TYPES.map((d,i) => `${i+1}. ${d.name}`).join('\n')
        );
      }

      // STEP 3: Document Type → Centre list
if (user.applyState === 'document') {
  const idx = num - 1;
  if (isNaN(idx) || idx < 0 || idx >= DOCUMENT_TYPES.length) {
    return sendMessage(From, `Invalid choice. Enter 1–${DOCUMENT_TYPES.length}.`);
  }
  const doc = DOCUMENT_TYPES[idx];
  user.applyDataTemp.documentType = doc.key;
  user.applyDataTemp.documentName = doc.name;
  user.applyState = 'centre';
  await user.save();

  // 🔧 Fixed: Use `$eq` to match Boolean true and prevent undefined issues
  const centres = await CentreModel.find({
    type: { $in: ['akshaya', 'csc'] }, // ✅ Support both types
    district: user.applyDataTemp.district,
    subdistrict: user.applyDataTemp.subdistrict,
    [`services.${doc.key}`]: true
  }).limit(5);  

  if (!centres.length) {
    // ⛔ Still no match — show fallback message
    user.applyState = 'document';
    await user.save();
    return sendMessage(From, "❌ No centres offer that service here. Choose another document:\n" +
      DOCUMENT_TYPES.map((d,i) => `${i+1}. ${d.name}`).join('\n')
    );
  }

  user.applyDataTemp.centres = centres.map(c => ({
    centreId:   c.centerId,
    centreName: c.centreName,
    type:       c.type,
    address:    c.address,
    phone:      c.phone
  }));
  await user.save();
  
  return sendMessage(From,
    "*Select Centre:*\n" +
    user.applyDataTemp.centres.map((c, i) => 
      `${i+1}. ${c.centreName} (${c.type.toUpperCase()})\n📍 ${c.address}\n📞 ${c.phone}\n🆔 ${c.centreId}`
    ).join('\n\n')
  );  
}

      // STEP 4: Centre → Create Service Request & Persist
      if (user.applyState === 'centre') {
        const list = user.applyDataTemp.centres || [];
        const idx  = num - 1;
        if (isNaN(idx) || idx < 0 || idx >= list.length) {
          return sendMessage(From, `Invalid choice. Enter 1–${list.length}.`);
        }
        const chosen = list[idx];

        try {
          const apiRes = await axios.post(
            `${CHAT_API_BASE}/api/service-request`,
            {
              "document-type": user.applyDataTemp.documentName,
              "centre-id":     chosen.centreId
            }
          );
          const data = apiRes.data;

          const application = {
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
          };

          user.applications.push(application);
          user.applyState = null;
          user.applyDataTemp = {};
          await user.save();

          const resp =
            `*${data.message}*\n` +
            `Request ID: ${data.serviceRequestId}\n` +
            `Required Docs:\n` +
            data.requiredDocuments.map(d=>`• ${d.name}`).join('\n') +
            `\nUpload Link: ${data.uploadLink}`;
          return sendMessage(From, resp);

        } catch (err) {
          console.error("Service‑request API error:", err);
          return sendMessage(From, "Error creating request. Please try again later.");
        }
      }

      // final fallback
      return sendMessage(From, "Unexpected state. Type 'hi' to restart.");
    }
  };
};
