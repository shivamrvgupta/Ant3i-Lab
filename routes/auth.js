const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// GET /login
router.get('/login', (req, res) => {
  if (req.cookies?.token) {
    try {
      const p = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
      return res.redirect(p.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard');
    } catch { /* ignore */ }
  }
  res.render('auth/login', { error: null });
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.isActive) {
      return res.render('auth/login', { error: 'Invalid credentials or account disabled.' });
    }
    const ok = await user.verifyPassword(password);
    if (!ok) {
      return res.render('auth/login', { error: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,  // 8 hours in ms
    });

    return res.redirect(user.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard');
  } catch (err) {
    console.error(err);
    return res.render('auth/login', { error: 'Something went wrong. Please try again.' });
  }
});

// GET /logout
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/login');
});

module.exports = router;
