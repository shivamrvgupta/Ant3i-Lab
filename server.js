require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const connectDB = require('./config/db');

const app = express();

// ── View engine ──────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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
app.use((req, res) => res.status(404).render('error', { message: 'Page not found.' }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running → http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('DB connection failed:', err.message);
    process.exit(1);
  });
