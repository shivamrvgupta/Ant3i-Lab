const mongoose = require('mongoose');

const fieldMappingSchema = new mongoose.Schema({
  fieldName: { type: String, default: '', trim: true },  // form field key, e.g. 'visc'
  label:     { type: String, default: '', trim: true },  // display label in report form
  unit:      { type: String, default: '', trim: true },  // display unit, e.g. 'cSt'
  specType:  { type: String, enum: ['none', 'min', 'max', 'range', 'text', 'visual', 'info'], default: 'none' },
  specMin:   { type: Number },
  specMax:   { type: Number },
  specText:  { type: String, default: '' },              // default/expected value for text/visual
  method:    { type: String, default: '', trim: true },  // override method for this specific field
}, { _id: false });

const testCatalogSchema = new mongoose.Schema({
  code:        { type: String, required: true, unique: true, trim: true },
  name:        { type: String, required: true, trim: true },
  method:      { type: String, default: '', trim: true },
  testingType: { type: String, default: '', trim: true },
  rate:        { type: Number, required: true, min: 0 },
  isActive:    { type: Boolean, default: true },

  // Report form field mappings (multiple fields per test)
  fields:      [fieldMappingSchema],
}, { timestamps: true });

module.exports = mongoose.model('TestCatalog', testCatalogSchema);
