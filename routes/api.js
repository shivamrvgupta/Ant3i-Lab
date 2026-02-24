const express = require('express');
const Customer = require('../models/Customer');
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

module.exports = router;
