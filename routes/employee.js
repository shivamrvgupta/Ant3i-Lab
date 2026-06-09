const express      = require('express');
const User         = require('../models/User');
const Customer     = require('../models/Customer');
const Report       = require('../models/Report');
const TestRequest  = require('../models/TestRequest');
const { allocateReportNo, peekNextReportNo } = require('../services/reportNo');
const { renderReportToPDF, renderInvoiceToPDF } = require('../services/pdfService');
const { sendReportEmail, sendBookingAcceptedEmail, sendWhatsAppBookingAccepted, sendReportToCustomerEmail, sendWhatsAppReportReady } = require('../services/emailService');
const { verifyJWT, requireRole } = require('../middleware/auth');
const TestCatalog  = require('../models/TestCatalog');
const { buildParams, buildDistPoints, formValsFromReport, buildParamsFromCatalog } = require('../services/reportBuilder');
const FuelType = require('../models/FuelType');

const router = express.Router();
router.use(verifyJWT, requireRole('employee'));

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /employee/dashboard
router.get('/dashboard', async (req, res) => {
  const [recentReports, pendingCount, myReportCount, pendingRequests] = await Promise.all([
    Report.find({ createdBy: req.user.id }).sort({ createdAt: -1 }).limit(5).lean(),
    TestRequest.countDocuments({ status: 'pending' }),
    Report.countDocuments({ createdBy: req.user.id }),
    TestRequest.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(5).lean(),
  ]);

  // Build invoice link map + payment status map: reportId → requestId / paymentStatus
  const reportIds = recentReports.map(r => r._id);
  const linkedReqs = await TestRequest.find({ reportId: { $in: reportIds } }).select('_id reportId paymentStatus').lean();
  const invoiceLinkByReport = {};
  const paymentStatusByReport = {};
  for (const lr of linkedReqs) {
    if (lr.reportId) {
      invoiceLinkByReport[lr.reportId.toString()]    = lr._id.toString();
      paymentStatusByReport[lr.reportId.toString()]  = lr.paymentStatus || 'unpaid';
    }
  }

  res.render('employee/dashboard', { user: req.user, recentReports, pendingCount, myReportCount, pendingRequests, invoiceLinkByReport, paymentStatusByReport });
});

// GET /employee/reports
router.get('/reports', async (req, res) => {
  const reports = await Report.find({ createdBy: req.user.id })
    .sort({ createdAt: -1 }).lean();
  res.render('employee/reports', { user: req.user, reports });
});

// GET /employee/requests
router.get('/requests', async (req, res) => {
  const requests = await TestRequest.find().sort({ createdAt: -1 }).lean();
  res.render('employee/requests', { user: req.user, requests });
});

// GET /employee/requests/:id
router.get('/requests/:id', async (req, res) => {
  const request = await TestRequest.findById(req.params.id).lean();
  if (!request) return res.status(404).render('error', { message: 'Request not found.' });
  res.render('employee/request-detail', { user: req.user, request });
});

// POST /employee/requests/:id/accept
router.post('/requests/:id/accept', async (req, res) => {
  const request = await TestRequest.findById(req.params.id);
  if (!request) return res.status(404).render('error', { message: 'Request not found.' });

  request.status     = 'accepted';
  request.acceptedBy = req.user.id;
  await request.save();

  // Generate invoice PDF then send email + WhatsApp in background
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

  res.redirect(`/employee/reports/new?from=${request._id}`);
});

// POST /employee/requests/:id/reject
router.post('/requests/:id/reject', async (req, res) => {
  const request = await TestRequest.findById(req.params.id);
  if (!request) return res.status(404).render('error', { message: 'Request not found.' });

  request.status        = 'rejected';
  request.rejectionNote = (req.body.rejectionNote || '').trim();
  await request.save();

  res.redirect('/employee/requests');
});

// POST /employee/requests/:id/payment-toggle
router.post('/requests/:id/payment-toggle', async (req, res) => {
  const request = await TestRequest.findById(req.params.id);
  if (request) {
    request.paymentStatus = request.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    await request.save();
  }
  res.redirect('/employee/requests');
});

// GET /employee/requests/:id/invoice
router.get('/requests/:id/invoice', async (req, res) => {
  const request = await TestRequest.findById(req.params.id).lean();
  if (!request) return res.status(404).render('error', { message: 'Request not found.' });
  res.render('invoice', { request, user: req.user });
});

// GET /employee/reports/new
router.get('/reports/new', async (req, res) => {
  const nextReportNo = await peekNextReportNo();
  const today = new Date().toISOString().split('T')[0];

  let prefill = null;
  const [fuelTypes, catalogItemsAll] = await Promise.all([
    FuelType.find({ isActive: true }).sort({ name: 1 }).lean(),
    TestCatalog.find({ isActive: true }).sort({ code: 1 }).lean(),
  ]);
  let catalogItems = catalogItemsAll;

  if (req.query.from) {
    const tr = await TestRequest.findById(req.query.from).lean();
    if (tr) {
      const selectedCodes = (tr.selectedTests || []).map(t => t.code);
      // If complete test (1241) selected, use all catalog items; else filter to selected
      if (!selectedCodes.includes('1241')) {
        catalogItems = catalogItems.filter(c => selectedCodes.includes(c.code));
      }
      prefill = {
        fromRequestId:    String(tr._id),
        customer:         tr.company ? `${tr.name} (${tr.company})` : tr.name,
        sampleName:       tr.sampleName || 'DIESEL',
        sampleId:         tr.sampleId || '',
        packingCondition: tr.packingCondition || '',
        dateReceived:     new Date(tr.preferredDate).toISOString().split('T')[0],
        selectedCodes,
        fuelType:         tr.fuelType || 'BS-VI Diesel (10 ppm)',
      };
    }
  }

  res.render('employee/new-report', { user: req.user, nextReportNo, today, error: null, prefill, catalogItems, fuelTypes });
});

// POST /employee/reports — create
router.post('/reports', async (req, res) => {
  const b = req.body;
  try {
    const customerName = (b.customer || '').trim();
    if (customerName) {
      const existing = await Customer.findOne({ name: { $regex: `^${customerName}$`, $options: 'i' } });
      if (!existing) await Customer.create({ name: customerName }).catch(() => {});
    }

    // Use catalog-based param builder (load all active tests to match submitted fields)
    const [allCatalogItems, ftDoc] = await Promise.all([
      TestCatalog.find({ isActive: true }).lean(),
      FuelType.findOne({ name: b.fuelType }).lean(),
    ]);
    const fuelTypeSpecs = FuelType.toSpecsMap(ftDoc ? ftDoc.specs : []);
    const { params, failCount } = buildParamsFromCatalog(b, allCatalogItems, fuelTypeSpecs);
    const distPoints = buildDistPoints(b);
    const reportNo   = await allocateReportNo();

    const report = await Report.create({
      reportNo,
      customer:         customerName || '—',
      sampleName:       b.sampleName || 'DIESEL',
      fuelType:         b.fuelType || 'BS-VI Diesel (10 ppm)',
      reportDate:       new Date(b.reportDate),
      dateReceived:     b.dateReceived ? new Date(b.dateReceived) : new Date(b.reportDate),
      sampleId:         (b.sampleId || '').trim(),
      packingCondition: (b.packingCondition || '').trim(),
      specStd:          (ftDoc ? ftDoc.standardRef : null) || b.specStd || 'IS 1460:2017 (BS-VI)',
      createdBy:        req.user.id,
      params,
      distPoints,
      failCount,
      overallStatus:    failCount === 0 ? 'NORMAL' : 'NOT OK',
    });

    // Link report back to the originating request (if any)
    if (b.fromRequestId) {
      TestRequest.findByIdAndUpdate(b.fromRequestId, { reportId: report._id })
        .catch(err => console.error('[Link request error]', err.message));
    }

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
    const [nextReportNo, catalogItems, fuelTypes] = await Promise.all([
      peekNextReportNo(),
      TestCatalog.find({ isActive: true }).sort({ code: 1 }).lean(),
      FuelType.find({ isActive: true }).sort({ name: 1 }).lean(),
    ]);
    const today = new Date().toISOString().split('T')[0];
    res.render('employee/new-report', { user: req.user, nextReportNo, today, error: 'Failed to save report. Please try again.', prefill: null, catalogItems, fuelTypes });
  }
});

// POST /employee/reports/:id/send — manually send report PDF to customer
router.post('/reports/:id/send', async (req, res) => {
  const report = await Report.findById(req.params.id).populate('createdBy', 'name email').lean();
  if (!report) return res.redirect('/employee/dashboard');

  const linkedReq = await TestRequest.findOne({ reportId: report._id }).lean();
  if (!linkedReq) return res.redirect('/employee/dashboard');

  renderReportToPDF({ report, forPDF: true })
    .then(pdfBuffer => Promise.all([
      sendReportToCustomerEmail({
        to: linkedReq.email, name: linkedReq.name,
        requestNo: linkedReq.requestNo, reportNo: report.reportNo, pdfBuffer,
      }),
      sendWhatsAppReportReady({
        phone: linkedReq.phone, name: linkedReq.name,
        reportNo: report.reportNo, requestNo: linkedReq.requestNo,
        pdfBuffer, isPaid: true,
      }),
    ]))
    .catch(err => console.error('[Send report error]', err.message));

  res.redirect('/employee/dashboard');
});

// GET /employee/reports/:id/edit  — must be before /:id
router.get('/reports/:id/edit', async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, createdBy: req.user.id }).lean();
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
    backUrl:      `/employee/reports/${report._id}`,
    submitUrl:    `/employee/reports/${report._id}/edit`,
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
      const existing = await Customer.findOne({ name: { $regex: `^${customerName}$`, $options: 'i' } });
      if (!existing) await Customer.create({ name: customerName }).catch(() => {});
    }

    const activeCodes  = [].concat(b.activeCodes || []).filter(Boolean);
    const catalogItems = await TestCatalog.find(
      activeCodes.length ? { code: { $in: activeCodes } } : { isActive: true }
    ).sort({ code: 1 }).lean();

    const { params, failCount } = buildParamsFromCatalog(b, catalogItems);
    const distPoints = buildDistPoints(b);

    existing.customer         = customerName || '—';
    existing.sampleName       = b.sampleName || 'DIESEL';
    existing.reportDate       = new Date(b.reportDate);
    existing.dateReceived     = b.dateReceived ? new Date(b.dateReceived) : new Date(b.reportDate);
    existing.sampleId         = (b.sampleId || '').trim();
    existing.packingCondition = (b.packingCondition || '').trim();
    existing.specStd          = b.specStd || 'IS 1460:2017 (BS-VI)';
    existing.params           = params;
    existing.distPoints       = distPoints;
    existing.failCount        = failCount;
    existing.overallStatus    = failCount === 0 ? 'NORMAL' : 'NOT OK';
    await existing.save();

    res.redirect(`/employee/reports/${req.params.id}`);
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
      backUrl:      `/employee/reports/${req.params.id}`,
      submitUrl:    `/employee/reports/${req.params.id}/edit`,
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
