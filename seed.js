/**
 * seed.js — creates the initial Super Admin account + seeds the test catalog
 * Usage: node seed.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User        = require('./models/User');
const TestCatalog = require('./models/TestCatalog');
const FuelType    = require('./models/FuelType');
const { TESTS }   = require('./services/testCatalog');
const { FUEL_TYPES } = require('./services/fuelTypes');

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lab-reports';
  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // ── Admin user ──────────────────────────────────────────────────────────────
  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log(`Admin already exists: ${existing.email}`);
  } else {
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
  }

  // ── Test Catalog ─────────────────────────────────────────────────────────────
  const catalogCount = await TestCatalog.countDocuments();
  // Check if any existing entries are missing the new `fields` array (old schema)
  const needsMigration = catalogCount > 0 &&
    await TestCatalog.exists({ $or: [{ fields: { $exists: false } }, { fields: { $size: 0 }, code: { $nin: ['1241'] } }] });

  if (catalogCount === 0 || needsMigration) {
    if (needsMigration) {
      console.log('Catalog schema changed (fields array) — reseeding catalog...');
      await TestCatalog.deleteMany({});
    }
    await TestCatalog.insertMany(TESTS.map(t => ({ ...t, isActive: true })));
    console.log(`✅ Seeded ${TESTS.length} tests into catalog`);
    TESTS.forEach(t => console.log(`   ${t.code}  ${t.name}  ₹${t.rate}`));
  } else {
    console.log(`Test catalog already has ${catalogCount} entries — skipping.`);
  }

  // ── Fuel Types ───────────────────────────────────────────────────────────────
  const fuelTypeCount = await FuelType.countDocuments();
  if (fuelTypeCount === 0) {
    const docs = FUEL_TYPES.map(ft => ({
      name:        ft.name,
      standardRef: ft.standardRef,
      isActive:    true,
      specs:       Object.entries(ft.specs).map(([fieldName, s]) => ({
        fieldName,
        specType: s.specType || 'none',
        specMin:  s.specMin,
        specMax:  s.specMax,
        specText: s.specText || '',
      })),
    }));
    await FuelType.insertMany(docs);
    console.log(`✅ Seeded ${docs.length} fuel types`);
    docs.forEach(f => console.log(`   ${f.name}  (${f.standardRef})`));
  } else {
    console.log(`Fuel types already have ${fuelTypeCount} entries — skipping.`);
  }

  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
