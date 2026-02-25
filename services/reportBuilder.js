// Shared report-building logic used by both employee and admin routes.

const PARAM_DEFS = [
  { name: 'Appearance',                          method: 'Visual',     spec: 'Clear & Bright', unit: '-',      rule: { type: 'visual' } },
  { name: 'Viscosity @ 40\u00b0C',               method: 'ASTM D445',  spec: '2.0 \u2013 4.5', unit: 'cSt',   rule: { type: 'range', min: 2.0,   max: 4.5   } },
  { name: 'Flash Point - (PMCC)',                method: 'ASTM D93',   spec: 'Min. 35',         unit: '\u00b0C', rule: { type: 'min',   min: 35              } },
  { name: 'Density at 15\u00b0C',                method: 'ASTM D1298', spec: '0.810 to 0.845',  unit: 'g/cc',  rule: { type: 'range', min: 0.810, max: 0.845 } },
  { name: 'Total Sulphur',                       method: 'ASTM D5453', spec: 'Max. 10',         unit: 'mg/kg', rule: { type: 'max',   max: 10              } },
  { name: 'Cetane Index',                        method: 'ASTM D4737', spec: 'Min. 46',         unit: '-',     rule: { type: 'min',   min: 46              } },
  { name: 'Cetane Number',                       method: 'ASTM D613',  spec: 'Min. 49',         unit: '-',     rule: { type: 'min',   min: 49              } },
  { name: 'FAME Content',                        method: 'EN 14078',   spec: 'Max. 7',          unit: '% v/v', rule: { type: 'max',   max: 7               } },
  { name: 'Cold Filter Plugging Point (CFPP)',   method: 'IP 309',     spec: 'Max. 6',          unit: '\u00b0C', rule: { type: 'max',   max: 6               } },
  { name: 'Distillation, 95% Recovery',          method: 'ASTM D86',   spec: 'Max. 360',        unit: '\u00b0C', rule: { type: 'max',   max: 360             } },
  { name: 'Distillation Residue',                method: 'ASTM D86',   spec: 'NA',              unit: '%',     rule: { type: 'info'                       } },
  { name: 'Distillation Loss',                   method: 'ASTM D86',   spec: 'NA',              unit: '%',     rule: { type: 'info'                       } },
];

const FIELD_MAP = {
  'Viscosity @ 40\u00b0C':                     'visc',
  'Flash Point - (PMCC)':                      'flash',
  'Density at 15\u00b0C':                      'density',
  'Total Sulphur':                             'sulphur',
  'Cetane Index':                              'cetane',
  'Cetane Number':                             'cetaneNumber',
  'FAME Content':                              'fameContent',
  'Cold Filter Plugging Point (CFPP)':         'cfpp',
  'Distillation, 95% Recovery':               'd_95',
  'Distillation Residue':                     'distResidue',
  'Distillation Loss':                        'distLoss',
};

const DIST_LABEL_TO_FIELD = {
  'IBP': 'd_ibp', '5%': 'd_5', '10%': 'd_10', '15%': 'd_15',
  '20%': 'd_20', '30%': 'd_30', '40%': 'd_40', '50%': 'd_50',
  '60%': 'd_60', '70%': 'd_70', '80%': 'd_80', '85%': 'd_85',
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
    const key = FIELD_MAP[p.name];
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

module.exports = { PARAM_DEFS, FIELD_MAP, numVal, ruleStatus, buildParams, buildDistPoints, formValsFromReport };
