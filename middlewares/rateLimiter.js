const rateLimit = require("express-rate-limit");

const rateLimiterForAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { rateLimiterForAuth };