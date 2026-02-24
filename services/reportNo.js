const Counter = require('../models/Counter');

async function allocateReportNo() {
  const currentYear = new Date().getFullYear();

  // Atomic increment — reset count when year changes
  let doc = await Counter.findById('report');

  if (!doc || doc.year !== currentYear) {
    // New year — reset counter
    doc = await Counter.findByIdAndUpdate(
      'report',
      { year: currentYear, count: 1 },
      { upsert: true, new: true }
    );
  } else {
    doc = await Counter.findByIdAndUpdate(
      'report',
      { $inc: { count: 1 } },
      { new: true }
    );
  }

  return `Ant3i/Labs/${doc.year}/${String(doc.count).padStart(4, '0')}`;
}

async function peekNextReportNo() {
  const currentYear = new Date().getFullYear();
  const doc = await Counter.findById('report');
  if (!doc || doc.year !== currentYear) {
    return `Ant3i/Labs/${currentYear}/0001`;
  }
  return `Ant3i/Labs/${doc.year}/${String(doc.count + 1).padStart(4, '0')}`;
}

module.exports = { allocateReportNo, peekNextReportNo };
