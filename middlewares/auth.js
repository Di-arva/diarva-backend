const { verifyAccessToken } = require("../utils/jwt");

const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ success: false, message: "Unauthorized" });
    const token = authHeader.split(" ")[1];
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

const requireRole = (roles = []) => {
  if (typeof roles === "string") roles = [roles];
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  };
};

module.exports = { requireAuth, requireRole };