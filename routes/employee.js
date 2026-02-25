const express  = require('express');
const User     = require('../models/User');
const Customer = require('../models/Customer');
const Report   = require('../models/Report');
const { allocateReportNo, peekNextReportNo } = require('../services/reportNo');
const { renderReportToPDF }  = require('../services/pdfService');
const { sendReportEmail }    = require('../services/emailService');
const { verifyJWT, requireRole } = require('../middleware/auth');
const { buildParams, buildDistPoints, formValsFromReport } = require('../services/reportBuilder');

const router = express.Router();
router.use(verifyJWT, requireRole('employee'));

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /employee/dashboard
router.get('/dashboard', async (req, res) => {
  const recentReports = await Report.find({ createdBy: req.user.id })
    .sort({ createdAt: -1 }).limit(5).lean();
  res.render('employee/dashboard', { user: req.user, recentReports });
});

// GET /employee/reports
router.get('/reports', async (req, res) => {
  const reports = await Report.find({ createdBy: req.user.id })
    .sort({ createdAt: -1 }).lean();
  res.render('employee/reports', { user: req.user, reports });
});

// GET /employee/reports/new
router.get('/reports/new', async (req, res) => {
  const nextReportNo = await peekNextReportNo();
  const today = new Date().toISOString().split('T')[0];
  res.render('employee/new-report', { user: req.user, nextReportNo, today, error: null });
});

// POST /employee/reports — create
router.post('/reports', async (req, res) => {
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
    const reportNo   = await allocateReportNo();

    const report = await Report.create({
      reportNo,
      customer:         customerName || '—',
      sampleName:       b.sampleName || 'DIESEL',
      reportDate:       new Date(b.reportDate),
      dateReceived:     b.dateReceived ? new Date(b.dateReceived) : new Date(b.reportDate),
      sampleId:         (b.sampleId || '').trim(),
      packingCondition: (b.packingCondition || '').trim(),
      specStd:          b.specStd || 'IS 1460:2017 (BS-VI)',
      createdBy:        req.user.id,
      params,
      distPoints,
      failCount,
      overallStatus:    failCount === 0 ? 'NORMAL' : 'NOT OK',
    });

    // Redirect immediately — report is saved, don't block on PDF/email
    res.redirect(`/employee/reports/${report._id}`);

    // PDF generation + email happen in background; errors are logged but don't affect the user
    Report.findById(report._id).populate('createdBy', 'name email').lean()
      .then(populated => renderReportToPDF({ report: populated, forPDF: true }))
      .then(pdfBuffer => User.findOne({ role: 'admin' }).lean().then(admin => {
        if (admin) {
          return sendReportEmail({
            to:            admin.email,
            reportNo,
            customerName:  customerName || '—',
            createdByName: req.user.name,
            pdfBuffer,
          });
        }
      }))
      .catch(err => console.error('[PDF/Email background error]', err.message));
  } catch (err) {
    console.error(err);
    const nextReportNo = await peekNextReportNo();
    const today = new Date().toISOString().split('T')[0];
    res.render('employee/new-report', { user: req.user, nextReportNo, today, error: 'Failed to save report. Please try again.' });
  }
});

// GET /employee/reports/:id/edit  — must be before /:id
router.get('/reports/:id/edit', async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, createdBy: req.user.id }).lean();
  if (!report) return res.status(404).render('error', { message: 'Report not found.' });
  const vals = formValsFromReport(report);
  res.render('edit-report', {
    user:      req.user,
    report,
    vals,
    error:     null,
    backUrl:   `/employee/reports/${report._id}`,
    submitUrl: `/employee/reports/${report._id}/edit`,
  });
});

// POST /employee/reports/:id/edit
router.post('/reports/:id/edit', async (req, res) => {
  const b = req.body;
  try {
    const existing = await Report.findOne({ _id: req.params.id, createdBy: req.user.id });
    if (!existing) return res.status(404).render('error', { message: 'Report not found.' });

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

    res.redirect(`/employee/reports/${req.params.id}`);
  } catch (err) {
    console.error(err);
    const report = await Report.findById(req.params.id).lean();
    const vals   = formValsFromReport(report || {});
    res.render('edit-report', {
      user:      req.user,
      report,
      vals,
      error:     'Failed to update report. Please try again.',
      backUrl:   `/employee/reports/${req.params.id}`,
      submitUrl: `/employee/reports/${req.params.id}/edit`,
    });
  }
});

// GET /employee/reports/:id
router.get('/reports/:id', async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, createdBy: req.user.id })
    .populate('createdBy', 'name email').lean();
  if (!report) return res.status(404).render('error', { message: 'Report not found.' });
  res.render('report-view', { report, user: req.user, forPDF: false, inlineCSS: null, inlineJS: null });
});

module.exports = router;
