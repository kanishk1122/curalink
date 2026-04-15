const jwt = require('jsonwebtoken');

// High-speed auth memoization (1-min cache)
const authCache = new Map();

/**
 * Protect route - requires valid JWT cookie
 */
const protect = async (req, res, next) => {
  let token = req.cookies.token;

  if (token) {
    // 1. Check local memoization (Ultra-fast, sub-ms)
    const cached = authCache.get(token);
    if (cached && Date.now() < cached.expiry) {
      req.user = cached.user;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = { id: decoded.id };
      
      // 2. Hydrate cache
      authCache.set(token, { user, expiry: Date.now() + 60000 });
      
      req.user = user;
      return next();
    } catch (error) {
      console.error('Auth error:', error);
      return res.status(401).json({ error: 'Not authorized, token failed' });
    }
  }

  res.status(401).json({ error: 'Not authorized, no token' });
};

/**
 * Optional Auth - checks for user cookie but doesn't block guests
 */
const optional = async (req, res, next) => {
  const token = req.cookies.token;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.id };
    } catch (e) {
      // Ignore invalid tokens in optional mode
    }
  }
  next();
};

module.exports = { protect, optional };
