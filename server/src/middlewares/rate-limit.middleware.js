const rateLimit = require('express-rate-limit');

/**
 * Global API Rate Limiter
 * Standard protection against DDoS and abuse.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

/**
 * High-Sensitivity Auth Limiter
 * Specifically for login and registration to prevent brute-force attacks.
 */
const authLimiter = rateLimit({
  windowMs: 7 * 60 * 1000, // 7 minutes
  max: 10, // Limit each IP to 10 requests per window for auth (slightly more relaxed than plan for dev ease)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many login attempts. Please try again after 7 minutes.'
  }
});

module.exports = {
  globalLimiter,
  authLimiter
};
