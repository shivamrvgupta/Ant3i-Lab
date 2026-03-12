// Shared report-building logic used by both employee and admin routes.

const PARAM_DEFS = [
  { name: 'Appearance',                          method: 'Visual',     spec: 'Clear & Bright', unit: '-',      rule: { type: 'text' } },
  { name: 'Viscosity @ 40\u00b0C',               method: 'ASTM D445',  spec: '2.0 \u2013 4.5', unit: 'cSt',   rule: { type: 'range', min: 2.0,   max: 4.5   } },
  { name: 'Flash Point - (PMCC)',                method: 'ASTM D93',   spec: 'Min. 35',         unit: '\u00b0C', rule: { type: 'min',   min: 35              } },
  { name: 'Density at 15\u00b0C',                method: 'ASTM D1298', spec: '0.810 to 0.845',  unit: 'g/cc',  rule: { type: 'range', min: 0.810, max: 0.845 } },
  { name: 'Total Sulphur',                       method: 'ASTM D4294', spec: 'Max. 10',         unit: 'mg/kg', rule: { type: 'max',   max: 10              } },
  { name: 'Total Sulphur',                       method: 'ASTM D4294', spec: 'Max. 10',         unit: 'mg/kg', rule: { type: 'max',   max: 10              } },
  { name: 'Cetane Index',                        method: 'ASTM D4737', spec: 'Min. 46',         unit: '-',     rule: { type: 'min',   min: 46              } },
  { name: 'Cetane Number',                       method: 'ASTM D613',  spec: 'Min. 51',         unit: '-',     rule: { type: 'min',   min: 51              } },
  { name: 'Cold Filter Plugging Point (CFPP)',   method: 'ASTM D4731', spec: 'Max. 6',          unit: '\u00b0C', rule: { type: 'max',   max: 6               } },
  { name: 'Cetane Number',                       method: 'ASTM D613',  spec: 'Min. 51',         unit: '-',     rule: { type: 'min',   min: 51              } },
  { name: 'Cold Filter Plugging Point (CFPP)',   method: 'ASTM D4731', spec: 'Max. 6',          unit: '\u00b0C', rule: { type: 'max',   max: 6               } },
  { name: 'Distillation, 95% Recovery',          method: 'ASTM D86',   spec: 'Max. 360',        unit: '\u00b0C', rule: { type: 'max',   max: 360             } },
  { name: 'Distillation Residue',                method: 'ASTM D86',   spec: 'NA',              unit: '%',     rule: { type: 'info'                       } },
  { name: 'Distillation Loss',                   method: 'ASTM D86',   spec: 'NA',              unit: '%',     rule: { type: 'info'                       } },
];

const FIELD_MAP = {
  'Appearance':                                'appearance',
  'Viscosity @ 40\u00b0C':                     'visc',
  'Flash Point - (PMCC)':                      'flash',
  'Density at 15\u00b0C':                      'density',
  'Total Sulphur':                             'sulphur',
  'Cetane Index':                              'cetane',
  'Cetane Number':                             'cetaneNumber',
  'Cold Filter Plugging Point (CFPP)':         'cfpp',
  'Distillation, 95% Recovery':               'd_95',
  'Distillation Residue':                     'distResidue',
  'Distillation Loss':                        'distLoss',
};

const DIST_LABEL_TO_FIELD = {
  'IBP': 'd_ibp', '10%': 'd_10', '50%': 'd_50',
  '90%': 'd_90', '95%': 'd_95', '%(FBP)': 'd_fbp', 'Recovery %': 'd_recovery',
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

function buildParams(b) {
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
  return { params, failCount };
}

function buildDistPoints(b) {
  return [
    { label: 'IBP',        temp: numVal(b.d_ibp)  },
    { label: '10%',        temp: numVal(b.d_10)   },
    { label: '50%',        temp: numVal(b.d_50)   },
    { label: '90%',        temp: numVal(b.d_90)   },
    { label: '95%',        temp: numVal(b.d_95)   },
    { label: 'FBP',        temp: numVal(b.d_fbp)  },
    { label: 'Recovery %', temp: (b.d_recovery || '').trim() || null },
  ];
}

// Convert a saved report back into flat form field values for pre-filling the edit form.
function formValsFromReport(report) {
  const vals = {
    customer:         report.customer || '',
    sampleName:       report.sampleName || 'DIESEL',
    reportDate:       report.reportDate ? new Date(report.reportDate).toISOString().split('T')[0] : '',
    dateReceived:     report.dateReceived ? new Date(report.dateReceived).toISOString().split('T')[0] : '',
    sampleId:         report.sampleId || '',
    packingCondition: report.packingCondition || '',
    specStd:          report.specStd || 'IS 1460:2017 (BS-VI)',
  };

  for (const p of (report.params || [])) {
    const key = p.fieldName || FIELD_MAP[p.name]; // prefer stored fieldName, fall back to FIELD_MAP
    if (key && p.value !== null && p.value !== undefined && p.value !== 'NA') {
      vals[key] = p.value;
    }
  }

  for (const dp of (report.distPoints || [])) {
    const key = DIST_LABEL_TO_FIELD[dp.label];
    if (key && dp.temp !== null && dp.temp !== undefined) {
      vals[key] = dp.temp;
    }
  }

  return vals;
}

// ── Dynamic param builder from TestCatalog items ─────────────────────────────
// catalogItems: array of TestCatalog lean objects that are relevant to this report
// body: req.body from form submission
// Skips: code '1240' (distillation, handled separately) and code '1241' (umbrella)
// Skips any item where the field was not submitted (allows partial reports)
// fuelTypeSpecs: optional map of fieldName → { specType, specMin, specMax, specText }
// (from services/fuelTypes.js getFuelType(name).specs)
function buildParamsFromCatalog(body, catalogItems, fuelTypeSpecs = {}) {
  const params = [];
  for (const item of catalogItems) {
    if (item.code === '1241') continue; // umbrella — fields come from individual tests
    if (!item.fields || !item.fields.length) continue;

    for (const f of item.fields) {
      if (!f.fieldName) continue;

      // Fuel-type spec overrides take priority over catalog defaults
      const override = fuelTypeSpecs[f.fieldName] || {};
      const specType = override.specType || f.specType || 'none';
      const specMin  = override.specMin  != null ? override.specMin  : f.specMin;
      const specMax  = override.specMax  != null ? override.specMax  : f.specMax;
      const specText = override.specText != null ? override.specText : f.specText;

      const raw  = body[f.fieldName];
      // Skip fields not rendered in the form (test was not selected)
      if (raw === undefined) continue;
      const rule = {
        type: specType,
        min:  specMin,
        max:  specMax,
      };

      let value, display, numForRule;

      if (specType === 'text' || specType === 'visual') {
        const rawText = (raw || '').trim() || specText || 'NA';
        value = rawText; display = rawText; numForRule = null;
      } else if (specType === 'info' || specType === 'none') {
        const rawText = (typeof raw === 'string' ? raw.trim() : '');
        const rawNum  = numVal(raw);
        value   = rawNum !== null ? rawNum : (rawText || null);
        display = rawNum !== null ? String(rawNum) : (rawText || 'NA');
        numForRule = null;
      } else {
        const n = numVal(raw);
        if (n === null && (raw === undefined || raw === '')) continue; // field not submitted
        value = n; display = n !== null ? String(n) : 'NA'; numForRule = n;
      }

      // Build spec string
      let spec = 'NA';
      if (specType === 'min')                           spec = `Min. ${specMin}`;
      if (specType === 'max')                           spec = `Max. ${specMax}`;
      if (specType === 'range')                         spec = `${specMin} \u2013 ${specMax}`;
      if (specType === 'text' || specType === 'visual') spec = specText || 'NA';
      if (specType === 'info' || specType === 'none')   spec = 'NA';

      const status = ruleStatus(numForRule, rule);
      params.push({
        fieldName:     f.fieldName,
        name:          f.label || item.name,
        method:        f.method || item.method,
        spec,
        unit:          f.unit || '-',
        value,
        display,
        statusOk:      status.ok,
        statusDisplay: status.display,
      });
    }
  }

  const failCount = params.filter(p => !p.statusOk).length;
  return { params, failCount };
}

module.exports = { PARAM_DEFS, FIELD_MAP, numVal, ruleStatus, buildParams, buildDistPoints, formValsFromReport, buildParamsFromCatalog };
