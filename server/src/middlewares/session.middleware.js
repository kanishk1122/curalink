const { v4: uuidv4 } = require('uuid');

/**
 * Guest Session Isolation Middleware
 * Ensures every visitor has a unique sessionId for history compartmentalization.
 */
const sessionMiddleware = (req, res, next) => {
  let sid = req.cookies.curalink_sid;

  if (!sid) {
    sid = uuidv4();
    // Set a long-lived, secure cookie for guest tracking
    res.cookie('curalink_sid', sid, {
      httpOnly: true,
      secure: true, // Required for sameSite: 'none'
      sameSite: 'none', 
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 year
    });
  }

  req.sessionId = sid;
  next();
};

module.exports = sessionMiddleware;
