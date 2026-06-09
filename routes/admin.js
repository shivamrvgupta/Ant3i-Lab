const express      = require('express');
const User         = require('../models/User');
const Customer     = require('../models/Customer');
const Report       = require('../models/Report');
const TestRequest  = require('../models/TestRequest');
const TestCatalog  = require('../models/TestCatalog');
const FuelType     = require('../models/FuelType');
const { verifyJWT, requireRole } = require('../middleware/auth');
const { buildParamsFromCatalog, buildDistPoints, formValsFromReport } = require('../services/reportBuilder');
const { renderReportToPDF, renderInvoiceToPDF } = require('../services/pdfService');
const { sendBookingAcceptedEmail, sendReportToCustomerEmail, sendWhatsAppBookingAccepted, sendWhatsAppReportReady } = require('../services/emailService');

const router = express.Router();
router.use(verifyJWT, requireRole('admin'));

// GET /admin/dashboard
router.get('/dashboard', async (req, res) => {
  const [totalReports, totalCustomers, totalEmployees, recentReports, pendingRequests, recentRequests] = await Promise.all([
    Report.countDocuments(),
    Customer.countDocuments(),
    User.countDocuments({ role: 'employee' }),
    Report.find().sort({ createdAt: -1 }).limit(10).populate('createdBy', 'name').lean(),
    TestRequest.countDocuments({ status: 'pending' }),
    TestRequest.find().sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  res.render('admin/dashboard', {
    user: req.user,
    totalReports,
    totalCustomers,
    totalEmployees,
    recentReports,
    pendingRequests,
    recentRequests,
  });
});

// GET /admin/employees
router.get('/employees', async (req, res) => {
  const employees = await User.find({ role: 'employee' }).sort({ createdAt: -1 }).lean();
  res.render('admin/employees', { user: req.user, employees, error: null, success: null });
});

// POST /admin/employees  — create new employee
router.post('/employees', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const passwordHash = await User.hashPassword(password);
    await User.create({ name, email, passwordHash, role: 'employee' });
    const employees = await User.find({ role: 'employee' }).sort({ createdAt: -1 }).lean();
    res.render('admin/employees', { user: req.user, employees, error: null, success: 'Employee created successfully.' });
  } catch (err) {
    const employees = await User.find({ role: 'employee' }).sort({ createdAt: -1 }).lean();
    const error = err.code === 11000 ? 'Email already exists.' : 'Failed to create employee.';
    res.render('admin/employees', { user: req.user, employees, error, success: null });
  }
});

// POST /admin/employees/:id/toggle — activate/deactivate
router.post('/employees/:id/toggle', async (req, res) => {
  const emp = await User.findById(req.params.id);
  if (emp) {
    emp.isActive = !emp.isActive;
    await emp.save();
  }
  res.redirect('/admin/employees');
});

// GET /admin/customers
router.get('/customers', async (req, res) => {
  const customers = await Customer.find().sort({ name: 1 }).lean();
  res.render('admin/customers', { user: req.user, customers });
});

// GET /admin/reports
router.get('/reports', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const skip = (page - 1) * limit;

  const [reports, total] = await Promise.all([
    Report.find().sort({ createdAt: -1 }).skip(skip).limit(limit).populate('createdBy', 'name').lean(),
    Report.countDocuments(),
  ]);

  res.render('admin/reports', {
    user: req.user,
    reports,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// GET /admin/reports/:id/edit
router.get('/reports/:id/edit', async (req, res) => {
  const report = await Report.findById(req.params.id).lean();
  if (!report) return res.status(404).render('error', { message: 'Report not found.' });

  const allCatalog = await TestCatalog.find({ isActive: true }).sort({ code: 1 }).lean();
  const reportFieldNames = new Set((report.params || []).map(p => p.fieldName).filter(Boolean));
  const hasDistPoints = (report.distPoints || []).some(dp => dp.temp !== null);
  const catalogItems = reportFieldNames.size > 0 || hasDistPoints
    ? allCatalog.filter(item => {
        if (item.code === '1241') return false;
        if (item.code === '1240') return hasDistPoints || (item.fields || []).some(f => reportFieldNames.has(f.fieldName));
        return (item.fields || []).some(f => reportFieldNames.has(f.fieldName));
      })
    : allCatalog.filter(c => c.code !== '1241');

  const fuelTypes = await FuelType.find({ isActive: true }).sort({ name: 1 }).lean();

  const vals = formValsFromReport(report);
  res.render('edit-report', {
    user:         req.user,
    report,
    vals,
    catalogItems,
    fuelTypes,
    error:        null,
    backUrl:      `/admin/reports/${report._id}`,
    submitUrl:    `/admin/reports/${report._id}/edit`,
  });
});

// POST /admin/reports/:id/edit
router.post('/reports/:id/edit', async (req, res) => {
  const b = req.body;
  try {
    const customerName = (b.customer || '').trim();
    if (customerName) {
      const existing = await Customer.findOne({ name: { $regex: `^${customerName}$`, $options: 'i' } });
      if (!existing) {
        await Customer.create({ name: customerName }).catch(() => {});
      }
    }

    const activeCodes   = [].concat(b.activeCodes || []).filter(Boolean);
    const [catalogItems, ftDoc] = await Promise.all([
      TestCatalog.find(
        activeCodes.length ? { code: { $in: activeCodes } } : { isActive: true }
      ).sort({ code: 1 }).lean(),
      FuelType.findOne({ name: b.fuelType }).lean(),
    ]);

    const fuelTypeSpecs = FuelType.toSpecsMap(ftDoc ? ftDoc.specs : []);
    const { params, failCount } = buildParamsFromCatalog(b, catalogItems, fuelTypeSpecs);
    const distPoints = buildDistPoints(b);

    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).render('error', { message: 'Report not found.' });

    report.customer         = customerName || '—';
    report.sampleName       = b.sampleName || 'DIESEL';
    report.fuelType         = b.fuelType || 'BS-VI Diesel (10 ppm)';
    report.reportDate       = new Date(b.reportDate);
    report.dateReceived     = b.dateReceived ? new Date(b.dateReceived) : new Date(b.reportDate);
    report.sampleId         = (b.sampleId || '').trim();
    report.packingCondition = (b.packingCondition || '').trim();
    report.specStd          = (ftDoc ? ftDoc.standardRef : null) || b.specStd || 'IS 1460:2017 (BS-VI)';
    report.params           = params;
    report.distPoints       = distPoints;
    report.failCount        = failCount;
    report.overallStatus    = failCount === 0 ? 'NORMAL' : 'NOT OK';
    await report.save();

    res.redirect(`/admin/reports/${req.params.id}`);
  } catch (err) {
    console.error(err);
    const report = await Report.findById(req.params.id).lean();
    const allCatalog = await TestCatalog.find({ isActive: true }).sort({ code: 1 }).lean();
    const reportFieldNames = new Set((report?.params || []).map(p => p.fieldName).filter(Boolean));
    const hasDistPoints = (report?.distPoints || []).some(dp => dp.temp !== null);
    const catalogItems = reportFieldNames.size > 0 || hasDistPoints
      ? allCatalog.filter(item => {
          if (item.code === '1241') return false;
          if (item.code === '1240') return hasDistPoints || (item.fields || []).some(f => reportFieldNames.has(f.fieldName));
          return (item.fields || []).some(f => reportFieldNames.has(f.fieldName));
        })
      : allCatalog.filter(c => c.code !== '1241');
    const fuelTypes = await FuelType.find({ isActive: true }).sort({ name: 1 }).lean();
    const vals = formValsFromReport(report || {});
    res.render('edit-report', {
      user:         req.user,
      report,
      vals,
      catalogItems,
      fuelTypes,
      error:        'Failed to update report. Please try again.',
      backUrl:      `/admin/reports/${req.params.id}`,
      submitUrl:    `/admin/reports/${req.params.id}/edit`,
    });
  }
});

// GET /admin/reports/:id
router.get('/reports/:id', async (req, res) => {
  const report = await Report.findById(req.params.id).populate('createdBy', 'name email').lean();
  if (!report) return res.status(404).render('error', { message: 'Report not found.' });
  res.render('report-view', { report, user: req.user, forPDF: false, inlineCSS: null, inlineJS: null });
});

// GET /admin/catalog
router.get('/catalog', async (req, res) => {
  const tests = await TestCatalog.find().sort({ code: 1 }).lean();
  res.render('admin/catalog', { user: req.user, tests, error: null, success: null });
});

function parseFields(rawFields) {
  return [].concat(rawFields || []).map(f => {
    const entry = {
      fieldName: (f.fieldName || '').trim(),
      label:     (f.label || '').trim(),
      unit:      (f.unit || '').trim(),
      specType:  f.specType || 'none',
      specText:  (f.specText || '').trim(),
      method:    (f.method || '').trim(),
    };
    if (f.specMin !== '' && f.specMin != null) entry.specMin = parseFloat(f.specMin);
    if (f.specMax !== '' && f.specMax != null) entry.specMax = parseFloat(f.specMax);
    return entry;
  }).filter(f => f.fieldName);
}

// POST /admin/catalog — add new test
router.post('/catalog', async (req, res) => {
  const { code, name, method, testingType, rate } = req.body;
  try {
    const doc = {
      code:        (code || '').trim(),
      name:        (name || '').trim(),
      method:      (method || '').trim(),
      testingType: (testingType || '').trim(),
      rate:        parseFloat(rate) || 0,
      fields:      parseFields(req.body.fields),
    };
    await TestCatalog.create(doc);
    const tests = await TestCatalog.find().sort({ code: 1 }).lean();
    res.render('admin/catalog', { user: req.user, tests, error: null, success: 'Test added successfully.' });
  } catch (err) {
    const tests = await TestCatalog.find().sort({ code: 1 }).lean();
    const error = err.code === 11000 ? 'A test with that code already exists.' : 'Failed to add test.';
    res.render('admin/catalog', { user: req.user, tests, error, success: null });
  }
});

// POST /admin/catalog/:id/edit
router.post('/catalog/:id/edit', async (req, res) => {
  const { name, method, testingType, rate } = req.body;
  const update = {
    name:        (name || '').trim(),
    method:      (method || '').trim(),
    testingType: (testingType || '').trim(),
    rate:        parseFloat(rate) || 0,
    fields:      parseFields(req.body.fields),
  };
  await TestCatalog.findByIdAndUpdate(req.params.id, update);
  res.redirect('/admin/catalog');
});

// POST /admin/catalog/:id/toggle — activate / deactivate
router.post('/catalog/:id/toggle', async (req, res) => {
  const test = await TestCatalog.findById(req.params.id);
  if (test) { test.isActive = !test.isActive; await test.save(); }
  res.redirect('/admin/catalog');
});

// GET /admin/requests
router.get('/requests', async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const skip  = (page - 1) * limit;
  const [requests, total] = await Promise.all([
    TestRequest.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    TestRequest.countDocuments(),
  ]);
  res.render('admin/requests', {
    user: req.user,
    requests,
    page,
    totalPages: Math.ceil(total / limit),
  });
});

// POST /admin/requests/:id/accept
router.post('/requests/:id/accept', async (req, res) => {
  const request = await TestRequest.findById(req.params.id);
  if (!request) return res.status(404).render('error', { message: 'Request not found.' });

  request.status     = 'accepted';
  request.acceptedBy = req.user.id;
  await request.save();

  renderInvoiceToPDF(request.toObject())
    .then(invoicePdfBuffer => Promise.all([
      sendBookingAcceptedEmail({
        to:            request.email,
        name:          request.name,
        requestNo:     request.requestNo,
        preferredDate: request.preferredDate,
        invoicePdfBuffer,
      }),
      sendWhatsAppBookingAccepted({
        phone:           request.phone,
        name:            request.name,
        requestNo:       request.requestNo,
        preferredDate:   request.preferredDate,
        invoicePdfBuffer,
      }),
    ]))
    .catch(err => console.error('[Accept notification error]', err.message));

  res.redirect('/admin/requests');
});

// POST /admin/requests/:id/reject
router.post('/requests/:id/reject', async (req, res) => {
  const request = await TestRequest.findById(req.params.id);
  if (!request) return res.status(404).render('error', { message: 'Request not found.' });

  request.status        = 'rejected';
  request.rejectionNote = (req.body.rejectionNote || '').trim();
  await request.save();

  res.redirect('/admin/requests');
});

// POST /admin/requests/:id/payment-toggle
router.post('/requests/:id/payment-toggle', async (req, res) => {
  const request = await TestRequest.findById(req.params.id);
  if (request) {
    const wasPaid = request.paymentStatus === 'paid';
    request.paymentStatus = wasPaid ? 'unpaid' : 'paid';
    await request.save();

    // When newly marked paid + has linked report → deliver report to customer
    if (!wasPaid && request.reportId) {
      let savedReport = null;
      Report.findById(request.reportId).populate('createdBy', 'name email').lean()
        .then(rep => { savedReport = rep; return rep ? renderReportToPDF({ report: rep, forPDF: true }) : null; })
        .then(pdfBuffer => {
          if (!pdfBuffer || !savedReport) return;
          return Promise.all([
            sendReportToCustomerEmail({
              to:        request.email,
              name:      request.name,
              requestNo: request.requestNo,
              reportNo:  savedReport.reportNo,
              pdfBuffer,
            }),
            sendWhatsAppReportReady({
              phone:     request.phone,
              name:      request.name,
              reportNo:  savedReport.reportNo,
              requestNo: request.requestNo,
              pdfBuffer,
              isPaid:    true,
            }),
          ]);
        })
        .catch(err => console.error('[Report delivery error]', err.message));
    }
  }
  res.redirect('/admin/requests');
});

// GET /admin/requests/:id/invoice
router.get('/requests/:id/invoice', async (req, res) => {
  const request = await TestRequest.findById(req.params.id).lean();
  if (!request) return res.status(404).render('error', { message: 'Request not found.' });
  res.render('invoice', { request, user: req.user });
});

// ── Fuel Types ────────────────────────────────────────────────────────────────

function parseFuelSpecs(rawSpecs) {
  return [].concat(rawSpecs || []).map(s => {
    const entry = {
      fieldName: (s.fieldName || '').trim(),
      specType:  s.specType || 'none',
      specText:  (s.specText || '').trim(),
    };
    if (s.specMin !== '' && s.specMin != null) entry.specMin = parseFloat(s.specMin);
    if (s.specMax !== '' && s.specMax != null) entry.specMax = parseFloat(s.specMax);
    return entry;
  }).filter(s => s.fieldName);
}

// GET /admin/fuel-types
router.get('/fuel-types', async (req, res) => {
  const fuelTypes = await FuelType.find().sort({ name: 1 }).lean();
  res.render('admin/fuel-types', { user: req.user, fuelTypes, error: null, success: null });
});

// POST /admin/fuel-types — add
router.post('/fuel-types', async (req, res) => {
  const { name, standardRef } = req.body;
  try {
    await FuelType.create({
      name:        (name || '').trim(),
      standardRef: (standardRef || '').trim(),
      specs:       parseFuelSpecs(req.body.specs),
    });
    const fuelTypes = await FuelType.find().sort({ name: 1 }).lean();
    res.render('admin/fuel-types', { user: req.user, fuelTypes, error: null, success: 'Fuel type added.' });
  } catch (err) {
    const fuelTypes = await FuelType.find().sort({ name: 1 }).lean();
    const error = err.code === 11000 ? 'A fuel type with that name already exists.' : 'Failed to add fuel type.';
    res.render('admin/fuel-types', { user: req.user, fuelTypes, error, success: null });
  }
});

// POST /admin/fuel-types/:id/edit
router.post('/fuel-types/:id/edit', async (req, res) => {
  const { name, standardRef } = req.body;
  await FuelType.findByIdAndUpdate(req.params.id, {
    name:        (name || '').trim(),
    standardRef: (standardRef || '').trim(),
    specs:       parseFuelSpecs(req.body.specs),
  });
  res.redirect('/admin/fuel-types');
});

// POST /admin/fuel-types/:id/toggle
router.post('/fuel-types/:id/toggle', async (req, res) => {
  const ft = await FuelType.findById(req.params.id);
  if (ft) { ft.isActive = !ft.isActive; await ft.save(); }
  res.redirect('/admin/fuel-types');
});

// Debug endpoint to check fuel types
router.get('/debug/fuel-types', async (req, res) => {
  const fuelTypes = await FuelType.find().sort({ name: 1 }).lean();
  res.json(fuelTypes);
});

module.exports = router;
