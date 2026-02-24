const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id:   { type: String },   // e.g. 'report'
  year:  { type: Number },
  count: { type: Number, default: 0 },
});

module.exports = mongoose.model('Counter', counterSchema);
