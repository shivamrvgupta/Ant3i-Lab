/**
 * seed.js — creates the initial Super Admin account
 * Usage: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lab-reports';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log(`Admin already exists: ${existing.email}`);
    process.exit(0);
  }

  const passwordHash = await User.hashPassword('Admin@123');
  await User.create({
    name:  'Super Admin',
    email: 'admin@lab.com',
    passwordHash,
    role:  'admin',
  });

  console.log('✅ Super Admin created');
  console.log('   Email:    admin@lab.com');
  console.log('   Password: Admin@123');
  console.log('   ⚠️  Change the password after first login!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
