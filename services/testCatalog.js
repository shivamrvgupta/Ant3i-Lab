// Single source of truth for all available tests and their prices.
// Used by the public booking form and route handlers.

const TESTS = [
  { code: '1231', name: 'Color',                                   method: 'ASTM D 1500', testingType: 'Manual',         rate: 900,  fields: [
    { fieldName: 'appearance',  label: 'Appearance',           unit: '-',      specType: 'text', specText: 'Clear & Bright' },
  ]},
  { code: '1232', name: 'Density @ 15°C',                          method: 'ASTM D 1298', testingType: 'Automatic',      rate: 900,  fields: [
    { fieldName: 'density',     label: 'Density @ 15°C',       unit: 'g/cc',   specType: 'range', specMin: 0.810, specMax: 0.845 },
  ]},
  { code: '1233', name: 'Viscosity @ 40°C',                        method: 'ASTM D 445',  testingType: 'Semi Automatic', rate: 950,  fields: [
    { fieldName: 'visc',        label: 'Viscosity @ 40°C',     unit: 'cSt',    specType: 'range', specMin: 2.0, specMax: 4.5 },
  ]},
  { code: '1234', name: 'Viscosity @ 100°C',                       method: 'ASTM D 445',  testingType: 'Semi Automatic', rate: 950,  fields: [
    { fieldName: 'visc100',     label: 'Viscosity @ 100°C',    unit: 'cSt',    specType: 'none' },
  ]},
  { code: '1235', name: 'Viscosity Index',                         method: 'Proprietary', testingType: 'Calculated',     rate: 950,  fields: [
    { fieldName: 'viscIndex',   label: 'Viscosity Index',      unit: '-',      specType: 'none' },
  ]},
  { code: '1236', name: 'Flash Point',                             method: 'ASTM D 93',   testingType: 'Automatic',      rate: 950,  fields: [
    { fieldName: 'flash',       label: 'Flash Point',          unit: '\u00b0C', specType: 'min', specMin: 35 },
  ]},
  { code: '1237', name: 'Total Sulfur',                            method: 'ASTM D 4294', testingType: 'Automatic',      rate: 1950, fields: [
    { fieldName: 'sulphur',     label: 'Total Sulphur',        unit: 'mg/kg',  specType: 'max', specMax: 10 },
  ]},
  { code: '1238', name: 'Cetane Index',                            method: 'ASTM D 4737', testingType: 'Automatic',      rate: 1750, fields: [
    { fieldName: 'cetane',      label: 'Cetane Index',         unit: '-',      specType: 'min', specMin: 46, method: 'ASTM D 4737' },
    { fieldName: 'cetaneNumber',label: 'Cetane Number',        unit: '-',      specType: 'min', specMin: 51, method: 'ASTM D 613'  },
  ]},
  { code: '1239', name: 'Cold Filter Plugging Point',              method: 'ASTM D 6371', testingType: 'Automatic',      rate: 1550, fields: [
    { fieldName: 'cfpp',        label: 'Cold Filter Plugging Point (CFPP)', unit: '\u00b0C', specType: 'max', specMax: 6 },
  ]},
  { code: '1240', name: 'Distillation (IBP, T10, T50, T95, FBP)', method: 'ASTM D 1550', testingType: 'Automatic',      rate: 1550, fields: [
    { fieldName: 'd_95',        label: 'Distillation, 95% Recovery', unit: '\u00b0C', specType: 'max',  specMax: 360, method: 'ASTM D 86' },
    { fieldName: 'distResidue', label: 'Distillation Residue',       unit: '%',       specType: 'info',              method: 'ASTM D 86' },
    { fieldName: 'distLoss',    label: 'Distillation Loss',          unit: '%',       specType: 'info',              method: 'ASTM D 86' },
  ]},
  { code: '1241', name: 'Complete Tests via IR Spectrum',           method: 'FTIR',        testingType: 'Automatic',      rate: 6500, fields: [] },
];

const GST_RATE = 0.18;

function calcTotal(selectedCodes) {
  const subtotal = TESTS
    .filter(t => selectedCodes.includes(t.code))
    .reduce((sum, t) => sum + t.rate, 0);
  const gst   = Math.round(subtotal * GST_RATE);
  const total = subtotal + gst;
  return { subtotal, gstAmount: gst, totalAmount: total };
}

module.exports = { TESTS, GST_RATE, calcTotal };
