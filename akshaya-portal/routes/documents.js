/* routes/documents.js */
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const Document = require('../models/Document');
const ServiceRequest = require('../models/ServiceRequest');
const router = express.Router();

// GET: continue application, auto-extract missing data
router.get('/continue-application/:serviceRequestId', async (req, res) => {
  if (!req.session.user) return res.redirect('/');
  try {
    const serviceRequest = await ServiceRequest.findById(req.params.serviceRequestId);
    if (!serviceRequest) return res.status(404).send('Service request not found.');

    let needsSave = false;
    for (let doc of serviceRequest.requiredDocuments) {
      if (doc.uploadedFile && !doc.fileData) {
        // call predict API
        const form = new FormData();
        form.append('image', fs.createReadStream(doc.uploadedFile));
        const predictRes = await axios.post('http://localhost:5000/predict', form, { headers: form.getHeaders() });
        const extracted = {};
        (predictRes.data.entities||[]).forEach(e => { extracted[e.label] = e.word; });
        doc.fileData = JSON.stringify(extracted);
        needsSave = true;
      }
    }
    if (needsSave) await serviceRequest.save();

    const customer = req.session.user || {};
    res.render('continueApplication', {
      customerName: customer.name,
      mobile: customer.mobile,
      email: customer.email,
      address: customer.address,
      dob: customer.dob,
      serviceRequest
    });
  } catch(err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;