const mongoose = require('mongoose');
const User = require('./models/User');
const AkshyaCenter = require('./models/AkshyaCenter');
const ServiceApplication = require('./models/ServiceApplication');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    // Create a sample user
    const user = new User({
      username: 'john_doe',
      password: 'password123',
    });
    await user.save();

    // Create a sample Akshya center
    const akshyaCenter = new AkshyaCenter({
      name: 'Sample Akshya Center',
      location: 'Sample Location',
      district: 'Sample District',
      subdistrict: 'Sample Subdistrict',
      services: [
        {
          serviceName: 'Aadhaar Card Application',
          requiredDocuments: ['Proof of Identity', 'Proof of Address', 'Passport Size Photo'],
        },
      ],
    });
    await akshyaCenter.save();

    // Create a sample service application
    const application = new ServiceApplication({
      userId: user._id,
      akshyaCenterId: akshyaCenter._id,
      serviceName: 'Aadhaar Card Application',
      requiredDocuments: [
        { documentName: 'Proof of Identity' },
        { documentName: 'Proof of Address' },
        { documentName: 'Passport Size Photo' },
      ],
      status: 'Pending',
    });
    await application.save();

    console.log('Sample data added successfully!');
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
})();