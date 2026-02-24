require('dotenv').config();
const express      = require('express');
const cookieParser = require('cookie-parser');
const morgan       = require('morgan');
const path         = require('path');
const connectDB    = require('./config/db');
const logger       = require('./config/logger');

const app = express();

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(morgan('combined', {
  stream: { write: msg => logger.http(msg.trim()) },
}));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/',         require('./routes/auth'));
app.use('/admin',    require('./routes/admin'));
app.use('/employee', require('./routes/employee'));
app.use('/api',      require('./routes/api'));

// Root redirect
app.get('/', (_req, res) => res.redirect('/login'));

// 404
app.use((_req, res) => res.status(404).render('error', { message: 'Page not found.' }));

// Error handler
app.use((err, req, res, _next) => {
  logger.error(`${req.method} ${req.url} — ${err.message}`, { stack: err.stack });
  res.status(500).render('error', { message: 'Internal server error.' });
});

// ── Process-level error catching ─────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason: String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { stack: err.stack });
  process.exit(1);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => logger.info(`Server running → http://localhost:${PORT}`));
  })
  .catch(err => {
    logger.error(`DB connection failed: ${err.message}`);
    process.exit(1);
  });
