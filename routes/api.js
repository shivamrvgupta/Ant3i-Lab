const express     = require('express');
const Customer    = require('../models/Customer');
const TestRequest = require('../models/TestRequest');
const FuelType    = require('../models/FuelType');
const { verifyJWT } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers/search?q=
router.get('/customers/search', verifyJWT, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);

  const customers = await Customer.find(
    { name: { $regex: q, $options: 'i' } },
    'name'
  ).limit(10).lean();

  res.json(customers.map(c => c.name));
});

// GET /api/slots?date=YYYY-MM-DD  (public — no auth required)
router.get('/slots', async (req, res) => {
  const dateStr = (req.query.date || '').trim();
  if (!dateStr) return res.json({ available: 0, total: 0, error: 'date required' });

  const dayStart = new Date(dateStr);
  if (isNaN(dayStart)) return res.json({ available: 0, total: 0, error: 'invalid date' });
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const max   = parseInt(process.env.MAX_DAILY_SLOTS) || 5;
  const count = await TestRequest.countDocuments({
    preferredDate: { $gte: dayStart, $lt: dayEnd },
    status: { $ne: 'rejected' },
  });

  res.json({ available: Math.max(0, max - count), total: max, date: dateStr });
});

// GET /api/fuel-type/:name  (for employee and admin — get fuel type specs)
router.get('/fuel-type/:name', verifyJWT, async (req, res) => {
  const ft = await FuelType.findOne({ name: req.params.name }).lean();
  if (!ft) return res.json({ specs: {} });

  const specsMap = {};
  if (ft.specs) {
    ft.specs.forEach(s => {
      if (s.fieldName) {
        specsMap[s.fieldName] = {
          specType: s.specType,
          specMin: s.specMin,
          specMax: s.specMax,
          specText: s.specText,
        };
      }
    });
  }
  res.json({ specs: specsMap });
});

module.exports = router;
