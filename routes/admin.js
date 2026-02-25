const express  = require('express');
const User     = require('../models/User');
const Customer = require('../models/Customer');
const Report   = require('../models/Report');
const { verifyJWT, requireRole } = require('../middleware/auth');
const { buildParams, buildDistPoints, formValsFromReport } = require('../services/reportBuilder');

const router = express.Router();
router.use(verifyJWT, requireRole('admin'));

// GET /admin/dashboard
router.get('/dashboard', async (req, res) => {
  const [totalReports, totalCustomers, totalEmployees, recentReports] = await Promise.all([
    Report.countDocuments(),
    Customer.countDocuments(),
    User.countDocuments({ role: 'employee' }),
    Report.find().sort({ createdAt: -1 }).limit(10).populate('createdBy', 'name').lean(),
  ]);

  res.render('admin/dashboard', {
    user: req.user,
    totalReports,
    totalCustomers,
    totalEmployees,
    recentReports,
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
  const vals = formValsFromReport(report);
  res.render('edit-report', {
    user:      req.user,
    report,
    vals,
    error:     null,
    backUrl:   `/admin/reports/${report._id}`,
    submitUrl: `/admin/reports/${report._id}/edit`,
  });
});

// POST /admin/reports/:id/edit
router.post('/reports/:id/edit', async (req, res) => {
  const b = req.body;
  try {
    const customerName = (b.customer || '').trim();
    if (customerName) {
      await Customer.findOneAndUpdate(
        { name: { $regex: `^${customerName}$`, $options: 'i' } },
        { name: customerName },
        { upsert: true }
      );
    }

    const { params, failCount } = buildParams(b);
    const distPoints = buildDistPoints(b);

    await Report.findByIdAndUpdate(req.params.id, {
      customer:         customerName || '—',
      sampleName:       b.sampleName || 'DIESEL',
      reportDate:       new Date(b.reportDate),
      dateReceived:     b.dateReceived ? new Date(b.dateReceived) : new Date(b.reportDate),
      sampleId:         (b.sampleId || '').trim(),
      packingCondition: (b.packingCondition || '').trim(),
      specStd:          b.specStd || 'IS 1460:2017 (BS-VI)',
      params,
      distPoints,
      failCount,
      overallStatus:    failCount === 0 ? 'NORMAL' : 'NOT OK',
    });

    res.redirect(`/admin/reports/${req.params.id}`);
  } catch (err) {
    console.error(err);
    const report = await Report.findById(req.params.id).lean();
    const vals   = formValsFromReport(report || {});
    res.render('edit-report', {
      user:      req.user,
      report,
      vals,
      error:     'Failed to update report. Please try again.',
      backUrl:   `/admin/reports/${req.params.id}`,
      submitUrl: `/admin/reports/${req.params.id}/edit`,
    });
  }
});

// GET /admin/reports/:id
router.get('/reports/:id', async (req, res) => {
  const report = await Report.findById(req.params.id).populate('createdBy', 'name email').lean();
  if (!report) return res.status(404).render('error', { message: 'Report not found.' });
  res.render('report-view', { report, user: req.user, forPDF: false, inlineCSS: null, inlineJS: null });
});

module.exports = router;
