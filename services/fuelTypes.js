// Fuel / product type definitions with per-field spec ranges.
// Each entry's `specs` map overrides the catalog defaults when generating a report.
// fieldName keys must match the `fieldName` values in the TestCatalog fields array.

const FUEL_TYPES = [
  {
    name:        'BS-VI Diesel (10 ppm)',
    standardRef: 'IS 1460:2017 (BS-VI)',
    specs: {
      appearance:   { specType: 'text',  specText: 'Clear & Bright' },
      density:      { specType: 'range', specMin: 0.820, specMax: 0.845 },
      visc:         { specType: 'range', specMin: 2.0,   specMax: 4.5   },
      flash:        { specType: 'min',   specMin: 35 },
      sulphur:      { specType: 'max',   specMax: 10 },
      cetane:       { specType: 'min',   specMin: 46 },
      cetaneNumber: { specType: 'min',   specMin: 51 },
      cfpp:         { specType: 'max',   specMax: 6  },
    },
  },
  {
    name:        'BS-IV Diesel (50 ppm)',
    standardRef: 'IS 1460:2005 (BS-IV)',
    specs: {
      appearance:   { specType: 'text',  specText: 'Clear & Bright' },
      density:      { specType: 'range', specMin: 0.820, specMax: 0.845 },
      visc:         { specType: 'range', specMin: 2.0,   specMax: 4.5   },
      flash:        { specType: 'min',   specMin: 35 },
      sulphur:      { specType: 'max',   specMax: 50 },
      cetane:       { specType: 'min',   specMin: 46 },
      cetaneNumber: { specType: 'min',   specMin: 46 },
      cfpp:         { specType: 'max',   specMax: 6  },
    },
  },
  {
    name:        'MHO / Bunker Fuel',
    standardRef: 'IS 1593 / ISO 8217',
    specs: {
      density:      { specType: 'max',   specMax: 0.991 },
      visc:         { specType: 'range', specMin: 2.0,   specMax: 11.0 },
      flash:        { specType: 'min',   specMin: 60 },
      sulphur:      { specType: 'max',   specMax: 3500 },
      cetane:       { specType: 'none' },
      cetaneNumber: { specType: 'none' },
      cfpp:         { specType: 'none' },
    },
  },
  {
    name:        'Fuel Oil',
    standardRef: 'IS 1593:2026',
    specs: {
      visc:         { specType: 'range', specMin: 80,    specMax: 125 },
      sulphur:      { specType: 'max',   specMax: 35000 },
      flash:        { specType: 'min',   specMin: 60 },
    },
  },
  {
    name:        'HIGH SPEED DIESEL',
    standardRef: 'IS 16861:2026',
    specs: {
      density:      { specType: 'max',   specMax: 0.86 },
      visc:         { specType: 'range', specMin: 2.0,    specMax: 5.0 },
      sulphur:      { specType: 'max',   specMax: 2000 },
      cetaneNumber: { specType: 'min',   specMin: 45 },
      cfpp:         { specType: 'max',   specMax: 6 },
    },
  },
];

function getFuelType(name) {
  return FUEL_TYPES.find(f => f.name === name) || null;
}

module.exports = { FUEL_TYPES, getFuelType };
