// controllers/modules/applyModule.js
const axios     = require('axios');
const UserModel = require('../../models/user');

module.exports = function(sendMessage, CHAT_API_BASE) {
  const DISTRICTS = [
    "Thiruvananthapuram","Kollam","Pathanamthitta","Alappuzha",
    "Kottayam","Idukki","Ernakulam","Thrissur",
    "Palakkad","Malappuram","Kozhikode","Wayanad",
    "Kannur","Kasaragod"
  ];

  return {
    process: async (Body, user, From) => {
      const lower = Body.trim().toLowerCase();

      // STEP 0: Ask for District
      if (!user.applyState) {
        user.applyState = 'district';
        await user.save();
        const msg = "*Select your district:*\n" +
          DISTRICTS.map((d,i) => `${i+1}. ${d}`).join('\n');
        return sendMessage(From, msg);
      }

      // STEP 1: District selected → ask Subdistricts
      if (user.applyState === 'district') {
        const idx = parseInt(Body) - 1;
        if (isNaN(idx) || idx<0 || idx>=DISTRICTS.length) {
          return sendMessage(From, "Invalid district. Please enter a number from 1 to 14.");
        }
        user.applyData.district = DISTRICTS[idx];
        user.applyState = 'subdistrict';
        await user.save();

        // Fetch distinct subdistricts (address.locality) from Users in that district
        const subs = await UserModel.distinct('address.locality', { district: user.applyData.district });
        if (!subs.length) {
          return sendMessage(From, `No subdistricts found for ${user.applyData.district}.`);
        }
        const msg = `*Select your subdistrict in ${user.applyData.district}:*\n` +
          subs.map((s,i) => `${i+1}. ${s}`).join('\n');
        return sendMessage(From, msg);
      }

      // STEP 2: Subdistrict selected → ask Centres/Persons
      if (user.applyState === 'subdistrict') {
        // retrieve subdistrict list again
        const subs = await UserModel.distinct('address.locality', { district: user.applyData.district });
        const idx = parseInt(Body) - 1;
        if (isNaN(idx) || idx<0 || idx>=subs.length) {
          return sendMessage(From, `Invalid subdistrict. Enter 1–${subs.length}.`);
        }
        user.applyData.subdistrict = subs[idx];
        user.applyState = 'centre';
        await user.save();

        // Find users (centres) in that district+subdistrict
        const persons = await UserModel.find({
          district: user.applyData.district,
          'address.locality': user.applyData.subdistrict
        });
        if (!persons.length) {
          return sendMessage(From, `No centres found in ${user.applyData.subdistrict}.`);
        }
        const msg = `*Select your centre/person:*\n` +
          persons.map((p,i) =>
            `${i+1}. ${p.personName} (${p.shopName}) [ID: ${p.centerId}]`
          ).join('\n');
        // Cache persons in applyData for lookup
        user.applyData.persons = persons.map(p => ({
          centreId: p.centerId,
          services: p.services
        }));
        await user.save();
        return sendMessage(From, msg);
      }

      // STEP 3: Centre selected → ask Services
      if (user.applyState === 'centre') {
        const persons = user.applyData.persons || [];
        const idx = parseInt(Body) - 1;
        if (isNaN(idx) || idx<0 || idx>=persons.length) {
          return sendMessage(From, `Invalid selection. Enter 1–${persons.length}.`);
        }
        const chosen = persons[idx];
        user.applyData.centreId = chosen.centreId;
        user.applyState = 'service';
        await user.save();

        // List enabled services
        const svcObj = chosen.services || {};
        const svcList = Object.entries(svcObj)
          .filter(([_,enabled]) => enabled)
          .map(([name]) => name.replace(/_/g,' '));
        if (!svcList.length) {
          return sendMessage(From, "No services available at this centre.");
        }
        const msg = "*Select a service:*\n" +
          svcList.map((s,i) => `${i+1}. ${s}`).join('\n');
        // Cache service names
        user.applyData.services = svcList;
        await user.save();
        return sendMessage(From, msg);
      }

      // STEP 4: Service selected → call service-request API
      if (user.applyState === 'service') {
        const services = user.applyData.services || [];
        const idx = parseInt(Body) - 1;
        if (isNaN(idx) || idx<0 || idx>=services.length) {
          return sendMessage(From, `Invalid selection. Enter 1–${services.length}.`);
        }
        const serviceName = services[idx];
        user.applyData.serviceName = serviceName;
        // Reset state
        user.applyState = null;
        await user.save();

        // Call your service-request API
        try {
          const apiRes = await axios.post(`${CHAT_API_BASE}/api/service-request`, {
            "document-type": serviceName,
            "centre-id": user.applyData.centreId
          });
          const data = apiRes.data;
          // Format response
          let resp = `*${data.message}*\nRequest ID: ${data.serviceRequestId}\nRequired Documents:\n` +
            data.requiredDocuments.map(d => `• ${d.name}`).join('\n') +
            `\nUpload Link: ${data.uploadLink}`;
          return sendMessage(From, resp);
        } catch (e) {
          console.error("Service-request API error:", e);
          return sendMessage(From, "Error creating service request. Please try again later.");
        }
      }

      // Fallback
      await sendMessage(From, "Unexpected state. Type 'hi' to restart.");
    }
  };
};
