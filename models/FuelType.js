const mongoose = require('mongoose');

const specEntrySchema = new mongoose.Schema({
  fieldName: { type: String, trim: true },
  specType:  { type: String, enum: ['none', 'min', 'max', 'range', 'text', 'visual', 'info'], default: 'none' },
  specMin:   { type: Number },
  specMax:   { type: Number },
  specText:  { type: String, default: '' },
}, { _id: false });

const fuelTypeSchema = new mongoose.Schema({
  name:        { type: String, required: true, unique: true, trim: true },
  standardRef: { type: String, default: '', trim: true },
  isActive:    { type: Boolean, default: true },
  specs:       [specEntrySchema],
}, { timestamps: true });

// Convert specs array to a map keyed by fieldName for use in buildParamsFromCatalog
fuelTypeSchema.methods.specsMap = function () {
  const map = {};
  for (const s of this.specs) {
    if (s.fieldName) map[s.fieldName] = s.toObject ? s.toObject() : s;
  }
  return map;
};

// Works on lean objects too
fuelTypeSchema.statics.toSpecsMap = function (specsArray) {
  const map = {};
  for (const s of (specsArray || [])) {
    if (s.fieldName) map[s.fieldName] = s;
  }
  return map;
};

module.exports = mongoose.model('FuelType', fuelTypeSchema);
