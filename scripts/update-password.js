// Script to update user password
// Run with: node scripts/update-password.js

require('dotenv').config({ path: './akshaya-portal/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI;
const PHONE_NUMBER = '9446565036';
const NEW_PASSWORD = '111111111';

async function updatePassword() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, { dbName: 'akshyaportal' });
        console.log('✅ Connected to MongoDB');

        // Get the User collection directly
        const User = mongoose.connection.collection('user');

        // Find the user
        const user = await User.findOne({ phone: PHONE_NUMBER });

        if (!user) {
            console.log(`❌ User with phone ${PHONE_NUMBER} not found`);
            process.exit(1);
        }

        console.log(`📋 Found user: ${user.username} (${user.personName})`);

        // Hash the new password
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

        // Update the password
        const result = await User.updateOne(
            { phone: PHONE_NUMBER },
            { $set: { password: hashedPassword } }
        );

        if (result.modifiedCount > 0) {
            console.log(`✅ Password updated successfully for user: ${user.username}`);
            console.log(`📱 Phone: ${PHONE_NUMBER}`);
            console.log(`🔐 New password: ${NEW_PASSWORD}`);
        } else {
            console.log('⚠️ No changes made');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

updatePassword();
