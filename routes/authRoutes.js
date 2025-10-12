const express = require("express");
const router = express.Router();

const {
  register,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
  sendOtp,
  verifyOtp,
  resendOtp,
} = require("../controllers/authController");

const { rateLimiterForAuth } = require("../middlewares/rateLimiter");
const { requireAuth } = require("../middlewares/auth");

router.post("/register", register);
router.post("/login", rateLimiterForAuth, login);
router.post("/refresh", refresh);
router.post("/logout", requireAuth, logout);

router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);

router.post("/otp/send", rateLimiterForAuth, sendOtp);
router.post("/verify-otp", rateLimiterForAuth, verifyOtp);
router.post("/resend-otp", rateLimiterForAuth, resendOtp);

module.exports = router;