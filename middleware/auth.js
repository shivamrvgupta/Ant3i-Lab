const jwt = require('jsonwebtoken');

function verifyJWT(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/login');

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;   // { id, name, email, role }
    next();
  } catch {
    res.clearCookie('token');
    return res.redirect('/login');
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.redirect('/login');
    if (req.user.role !== role) return res.status(403).render('error', { message: 'Access denied.' });
    next();
  };
}

module.exports = { verifyJWT, requireRole };
