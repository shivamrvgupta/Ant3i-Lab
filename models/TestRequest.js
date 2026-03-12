const mongoose = require('mongoose');

const selectedTestSchema = new mongoose.Schema({
  code:   String,
  name:   String,
  method: String,
  rate:   Number,
}, { _id: false });

const testRequestSchema = new mongoose.Schema({
  requestNo:        { type: String, required: true, unique: true },
  name:             { type: String, required: true },
  email:            { type: String, required: true },
  phone:            { type: String, required: true },
  company:          { type: String, default: '' },
  sampleName:       { type: String, default: 'DIESEL' },
  sampleId:         { type: String, default: '' },
  packingCondition: { type: String, default: '' },
  selectedTests:    [selectedTestSchema],
  preferredDate:    { type: Date, required: true },
  subtotal:         { type: Number, default: 0 },
  gstAmount:        { type: Number, default: 0 },
  totalAmount:      { type: Number, default: 0 },
  status:           { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  acceptedBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reportId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  rejectionNote:    { type: String, default: '' },
  fuelType:         { type: String, default: 'BS-VI Diesel (10 ppm)' },
  paymentStatus:    { type: String, enum: ['unpaid', 'paid'], default: 'unpaid' },
}, { timestamps: true });

module.exports = mongoose.model('TestRequest', testRequestSchema);
