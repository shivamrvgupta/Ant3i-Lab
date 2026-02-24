const mongoose = require('mongoose');
const logger   = require('./logger');

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lab-reports';
  await mongoose.connect(uri);
  logger.info(`MongoDB connected → ${uri}`);
}

module.exports = connectDB;
