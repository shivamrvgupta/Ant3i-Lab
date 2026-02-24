const mongoose = require('mongoose');

const paramSchema = new mongoose.Schema({
  name:          String,
  method:        String,
  spec:          String,
  unit:          String,
  value:         mongoose.Schema.Types.Mixed,
  display:       String,
  statusOk:      Boolean,
  statusDisplay: String,
}, { _id: false });

const distPointSchema = new mongoose.Schema({
  label: String,
  temp:  { type: mongoose.Schema.Types.Mixed, default: null }, // number or string (for Recovery %)
}, { _id: false });

const reportSchema = new mongoose.Schema({
  reportNo:         { type: String, required: true, unique: true },
  customer:         { type: String, required: true },
  sampleName:       { type: String, default: 'DIESEL' },
  reportDate:       { type: Date,   required: true },
  dateReceived:     { type: Date },
  sampleId:         { type: String, default: '' },
  packingCondition: { type: String, default: '' },
  specStd:          { type: String, default: 'IS 1460:2017 (BS-VI)' },
  createdBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  params:           [paramSchema],
  distPoints:       [distPointSchema],
  failCount:        { type: Number, default: 0 },
  overallStatus:    { type: String, enum: ['NORMAL', 'NOT OK'], default: 'NORMAL' },
}, { timestamps: true });

module.exports = mongoose.model('Report', reportSchema);
