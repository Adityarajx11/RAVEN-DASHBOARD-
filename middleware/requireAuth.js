/**
 * Middleware to protect routes that require authentication
 * Checks if user is stored in session; redirects to /auth/login if not
 */
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

module.exports = requireAuth;
