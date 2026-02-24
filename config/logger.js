const winston = require('winston');
const path    = require('path');
const fs      = require('fs');

const logDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Pretty format for console
const consoleFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack }) =>
    `${timestamp} [${level}] ${stack || message}`
  )
);

// JSON format for files
const fileFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: 'http',
  transports: [
    // Console — always on
    new winston.transports.Console({ format: consoleFormat }),

    // All logs (http and above)
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format:   fileFormat,
    }),

    // Errors only
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level:    'error',
      format:   fileFormat,
    }),
  ],
});

module.exports = logger;
