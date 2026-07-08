const express      = require('express');
const Counter      = require('../models/Counter');
const TestRequest  = require('../models/TestRequest');
const TestCatalog  = require('../models/TestCatalog');
const { TESTS: SEED_TESTS, GST_RATE } = require('../services/testCatalog');
const FuelType = require('../models/FuelType');
const { FUEL_TYPES } = require('../services/fuelTypes');
const { sendBookingConfirmationEmail, sendWhatsAppBookingReceived, sendWhatsAppAdminNewBooking } = require('../services/emailService');
const nodemailer = require('nodemailer');

async function getActiveFuelTypes() {
  const count = await FuelType.countDocuments();
  if (count === 0) {
    // Auto-seed on first use if DB is empty
    const docs = FUEL_TYPES.map(ft => ({
      name: ft.name, standardRef: ft.standardRef, isActive: true,
      specs: Object.entries(ft.specs).map(([fieldName, s]) => ({
        fieldName, specType: s.specType || 'none',
        specMin: s.specMin, specMax: s.specMax, specText: s.specText || '',
      })),
    }));
    await FuelType.insertMany(docs);
  }
  return FuelType.find({ isActive: true }).sort({ name: 1 }).lean();
}

const router = express.Router();

// Auto-seed catalog from static list if DB is empty
async function getActiveTests() {
  const count = await TestCatalog.countDocuments();
  if (count === 0) {
    await TestCatalog.insertMany(SEED_TESTS.map(t => ({
      code: t.code, name: t.name, method: t.method,
      testingType: t.testingType, rate: t.rate, isActive: true,
    })));
  }
  return TestCatalog.find({ isActive: true }).sort({ code: 1 }).lean();
}

// Allocate a REQ/YYYY/NNNN number
async function allocateRequestNo() {
  const currentYear = new Date().getFullYear();
  let doc = await Counter.findById('request');

  if (!doc || doc.year !== currentYear) {
    doc = await Counter.findByIdAndUpdate(
      'request',
      { year: currentYear, count: 1 },
      { upsert: true, new: true }
    );
  } else {
    doc = await Counter.findByIdAndUpdate(
      'request',
      { $inc: { count: 1 } },
      { new: true }
    );
  }
  return `REQ/${doc.year}/${String(doc.count).padStart(4, '0')}`;
}

// GET /book
router.get('/book', async (req, res) => {
  const [tests, fuelTypes] = await Promise.all([getActiveTests(), getActiveFuelTypes()]);
  const today = new Date().toISOString().split('T')[0];
  res.render('booking/form', { tests, today, fuelTypes, error: null });
});

// POST /book
router.post('/book', async (req, res) => {
  const b = req.body;
  const allTests = await getActiveTests();

  try {
    const selectedCodes = Array.isArray(b.tests) ? b.tests : (b.tests ? [b.tests] : []);
    if (!selectedCodes.length) {
      const fuelTypes = await getActiveFuelTypes();
      return res.render('booking/form', { tests: allTests, today: new Date().toISOString().split('T')[0], fuelTypes, error: 'Please select at least one test.' });
    }

    const selectedTests = allTests.filter(t => selectedCodes.includes(t.code));
    const subtotal      = selectedTests.reduce((s, t) => s + t.rate, 0);
    const gstAmount     = Math.round(subtotal * GST_RATE);
    const totalAmount   = subtotal + gstAmount;

    const requestNo = await allocateRequestNo();

    const request = await TestRequest.create({
      requestNo,
      name:             (b.name || '').trim(),
      email:            (b.email || '').trim().toLowerCase(),
      phone:            (b.phone || '').trim(),
      company:          (b.company || '').trim(),
      gstNumber:        (b.gstNumber || '').trim().toUpperCase(),
      fuelType:         (b.fuelType || 'BS-VI Diesel (10 ppm)').trim(),
      sampleName:       (b.sampleName || 'DIESEL').trim(),
      sampleId:         (b.sampleId || '').trim(),
      packingCondition: (b.packingCondition || '').trim(),
      selectedTests:    selectedTests.map(t => ({ code: t.code, name: t.name, method: t.method, rate: t.rate })),
      preferredDate:    new Date(b.preferredDate),
      subtotal,
      gstAmount,
      totalAmount,
    });

    sendBookingConfirmationEmail({
      to:            request.email,
      name:          request.name,
      requestNo,
      tests:         selectedTests,
      preferredDate: request.preferredDate,
      total:         totalAmount,
    }).catch(err => console.error('[Booking email error]', err.message));

    sendWhatsAppBookingReceived({
      phone:         request.phone,
      name:          request.name,
      requestNo,
      preferredDate: request.preferredDate,
      total:         totalAmount,
    }).catch(err => console.error('[WhatsApp booking error]', err.message));

    // Notify admins via WhatsApp
    sendWhatsAppAdminNewBooking({
      requestNo,
      customerName:  request.name + (request.company ? ` (${request.company})` : ''),
      testCount:     selectedTests.length,
      preferredDate: request.preferredDate,
      total:         totalAmount,
    }).catch(err => console.error('[Admin WhatsApp error]', err.message));

    // Notify admins via email (from ADMIN_EMAILS env var)
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);
    if (adminEmails.length) {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST, port: Number(process.env.EMAIL_PORT) || 587,
        secure: Number(process.env.EMAIL_PORT) === 465,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      const dateStr = new Date(request.preferredDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      transporter.sendMail({
        from:    `"ANT 3I Lab" <${process.env.EMAIL_USER}>`,
        to:      adminEmails.join(','),
        subject: `New Booking Request — ${requestNo}`,
        html: `<p>A new booking request has been submitted.</p>
               <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse">
                 <tr><td style="padding:4px 12px 4px 0;color:#666">Request No.</td><td><strong>${requestNo}</strong></td></tr>
                 <tr><td style="padding:4px 12px 4px 0;color:#666">Customer</td><td>${request.name}${request.company ? ' — ' + request.company : ''}</td></tr>
                 <tr><td style="padding:4px 12px 4px 0;color:#666">Preferred Date</td><td>${dateStr}</td></tr>
                 <tr><td style="padding:4px 12px 4px 0;color:#666">Tests</td><td>${selectedTests.length} test(s)</td></tr>
                 <tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td><strong>₹${totalAmount} (incl. GST)</strong></td></tr>
               </table>
               <p><a href="${process.env.APP_URL || 'http://localhost:' + (process.env.PORT || 2326)}/admin/requests">View in Admin Panel →</a></p>`,
      }).catch(err => console.error('[Admin email error]', err.message));
    }

    res.redirect(`/book/confirmation/${encodeURIComponent(requestNo)}`);
  } catch (err) {
    console.error(err);
    const fuelTypes = await getActiveFuelTypes();
    res.render('booking/form', { tests: allTests, today: new Date().toISOString().split('T')[0], fuelTypes, error: 'Something went wrong. Please try again.' });
  }
});

// GET /book/confirmation/REQ/YYYY/NNNN
// Nginx decodes %2F before forwarding, so the requestNo arrives as 3 path segments.
// Use a wildcard to capture the full path and reconstruct the requestNo.
router.get('/book/confirmation/*', async (req, res) => {
  const requestNo = req.params[0];  // e.g. "REQ/2026/0004"
  const request = await TestRequest.findOne({ requestNo }).lean();
  if (!request) return res.status(404).render('error', { message: 'Request not found.' });
  res.render('booking/confirmation', { request });
});

module.exports = router;
