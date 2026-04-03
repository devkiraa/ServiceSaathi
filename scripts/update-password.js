// Script to reset all user passwords
// Run with: node scripts/update-password.js

// Force public DNS for MongoDB Atlas SRV resolution
const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

require('dotenv').config({ path: './akshaya-portal/.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGO_URI = process.env.MONGO_URI;
const NEW_PASSWORD = 'Qwerty';

async function resetAllPasswords() {
    try {
        console.log('🔗 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI, { dbName: 'akshyaportal' });
        console.log('✅ Connected to MongoDB');

        const User = mongoose.connection.collection('user');

        // Get all users
        const users = await User.find({}).toArray();
        console.log(`📋 Found ${users.length} user(s)`);

        if (users.length === 0) {
            console.log('⚠️ No users found in the database');
            return;
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 10);

        // Update all users
        const result = await User.updateMany(
            {},
            { $set: { password: hashedPassword } }
        );

        console.log(`\n✅ Password reset complete!`);
        console.log(`🔐 New password for all users: ${NEW_PASSWORD}`);
        console.log(`👥 Users updated: ${result.modifiedCount}/${users.length}`);
        console.log('\nAffected users:');
        users.forEach(u => {
            console.log(`   • ${u.username} (${u.personName}) - ${u.role}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        process.exit(0);
    }
}

resetAllPasswords();
