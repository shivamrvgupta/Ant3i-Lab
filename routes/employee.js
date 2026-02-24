const express = require('express');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Report = require('../models/Report');
const { allocateReportNo, peekNextReportNo } = require('../services/reportNo');
const { renderReportToPDF } = require('../services/pdfService');
const { sendReportEmail } = require('../services/emailService');
const { verifyJWT, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(verifyJWT, requireRole('employee'));

// ── Param definitions ─────────────────────────────────────────────────────────
const PARAM_DEFS = [
  { name: 'Appearance',                                    method: 'Visual',      spec: 'Clear & Bright',  unit: '-',            rule: { type: 'visual' } },
  { name: 'Viscosity @ 40°C',                              method: 'ASTM D445',   spec: '2.0 – 4.5',       unit: 'cSt',          rule: { type: 'range', min: 2.0,   max: 4.5   } },
  { name: 'Flash Point - (PMCC)',                          method: 'ASTM D93',    spec: 'Min. 35',          unit: '°C',           rule: { type: 'min',   min: 35              } },
  { name: 'Density at 15°C',                               method: 'ASTM D1298',  spec: '0.810 to 0.845',  unit: 'g/cc',         rule: { type: 'range', min: 0.810, max: 0.845 } },
  { name: 'Total Sulphur',                                 method: 'ASTM D5453',  spec: 'Max. 10',          unit: 'mg/kg',        rule: { type: 'max',   max: 10              } },
  { name: 'Cetane Index',                                  method: 'ASTM D4737',  spec: 'Min. 46',          unit: '-',            rule: { type: 'min',   min: 46              } },
  { name: 'Cetane Number',                                 method: 'ASTM D613',   spec: 'Min. 49',          unit: '-',            rule: { type: 'min',   min: 49              } },
  { name: 'FAME Content',                                  method: 'EN 14078',    spec: 'Max. 7',           unit: '% v/v',        rule: { type: 'max',   max: 7               } },
  { name: 'Cold Filter Plugging Point (CFPP)',             method: 'IP 309',      spec: 'Max. 6',           unit: '°C',           rule: { type: 'max',   max: 6               } },
  { name: 'Distillation, 95% Recovery',                    method: 'ASTM D86',    spec: 'Max. 360',         unit: '°C',           rule: { type: 'max',   max: 360             } },
  { name: 'Distillation Residue',                          method: 'ASTM D86',    spec: 'NA',               unit: '%',            rule: { type: 'info'                       } },
  { name: 'Distillation Loss',                             method: 'ASTM D86',    spec: 'NA',               unit: '%',            rule: { type: 'info'                       } },
];

const FIELD_MAP = {
  'Viscosity @ 40°C':                            'visc',
  'Flash Point - (PMCC)':                        'flash',
  'Density at 15°C':                             'density',
      'Total Sulphur':                               'sulphur',
      'Cetane Index':                                'cetane',
      'Cetane Number':                               'cetaneNumber',
      'FAME Content':                                'fameContent',
      'Cold Filter Plugging Point (CFPP)':           'cfpp',
  'Distillation, 95% Recovery':                  'd_95',
  'Distillation Residue':                        'distResidue',
  'Distillation Loss':                           'distLoss',
};

function numVal(s) {
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}

function ruleStatus(val, rule) {
  if (rule.type === 'visual' || rule.type === 'text' || rule.type === 'info') return { ok: true, display: 'PASS' };
  if (val === null || val === undefined) return { ok: false, display: 'NA' };
  if (rule.type === 'range') { const ok = val >= rule.min && val <= rule.max; return { ok, display: ok ? 'PASS' : 'FAIL' }; }
  if (rule.type === 'min')   { const ok = val >= rule.min;                    return { ok, display: ok ? 'PASS' : 'FAIL' }; }
  if (rule.type === 'max')   { const ok = val <= rule.max;                    return { ok, display: ok ? 'PASS' : 'FAIL' }; }
  return { ok: false, display: 'NA' };
}

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

// POST /employee/reports
router.post('/reports', async (req, res) => {
  const b = req.body;

  try {
    // 1. Upsert customer
    const customerName = (b.customer || '').trim();
    if (customerName) {
      await Customer.findOneAndUpdate(
        { name: { $regex: `^${customerName}$`, $options: 'i' } },
        { name: customerName },
        { upsert: true }
      );
    }

    // 2. Build params
    const params = PARAM_DEFS.map(def => {
      const fieldKey = FIELD_MAP[def.name];
      let value, display, numForRule;

      if (def.rule.type === 'visual') {
        value = 'Clear & Bright'; display = 'Clear & Bright'; numForRule = null;
      } else if (def.rule.type === 'text' || def.rule.type === 'info') {
        const rawText = fieldKey ? (b[fieldKey] || '').trim() : '';
        value = rawText || 'NA'; display = rawText || 'NA'; numForRule = null;
      } else {
        const raw = fieldKey ? numVal(b[fieldKey]) : null;
        value = raw; display = raw !== null ? String(raw) : 'NA'; numForRule = raw;
      }

      const status = ruleStatus(numForRule, def.rule);
      return { name: def.name, method: def.method, spec: def.spec, unit: def.unit, value, display, statusOk: status.ok, statusDisplay: status.display };
    });

    const failCount = params.filter(p => !p.statusOk).length;

    // 3. Build distPoints
    const distPoints = [
      { label: 'IBP',        temp: numVal(b.d_ibp)  },
      { label: '5%',         temp: numVal(b.d_5)    },
      { label: '10%',        temp: numVal(b.d_10)   },
      { label: '15%',        temp: numVal(b.d_15)   },
      { label: '20%',        temp: numVal(b.d_20)   },
      { label: '30%',        temp: numVal(b.d_30)   },
      { label: '40%',        temp: numVal(b.d_40)   },
      { label: '50%',        temp: numVal(b.d_50)   },
      { label: '60%',        temp: numVal(b.d_60)   },
      { label: '70%',        temp: numVal(b.d_70)   },
      { label: '80%',        temp: numVal(b.d_80)   },
      { label: '85%',        temp: numVal(b.d_85)   },
      { label: '90%',        temp: numVal(b.d_90)   },
      { label: '95%',        temp: numVal(b.d_95)   },
      { label: '%(FBP)',     temp: numVal(b.d_fbp)  },
      { label: 'Recovery %', temp: (b.d_recovery || '').trim() || null },
    ];

    // 4. Allocate report number and save
    const reportNo = await allocateReportNo();

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

    // 5. Populate createdBy for PDF rendering
    const populatedReport = await Report.findById(report._id)
      .populate('createdBy', 'name email').lean();

    // 6. Generate PDF
    const pdfBuffer = await renderReportToPDF({ report: populatedReport, forPDF: true });

    // 7. Email to admin
    const admin = await User.findOne({ role: 'admin' }).lean();
    if (admin) {
      sendReportEmail({
        to:            admin.email,
        reportNo,
        customerName:  customerName || '—',
        createdByName: req.user.name,
        pdfBuffer,
      }).catch(err => console.error('Email send failed:', err));
    }

    res.redirect(`/employee/reports/${report._id}`);
  } catch (err) {
    console.error(err);
    const nextReportNo = await peekNextReportNo();
    const today = new Date().toISOString().split('T')[0];
    res.render('employee/new-report', {
      user: req.user,
      nextReportNo,
      today,
      error: 'Failed to generate report. Please try again.',
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
