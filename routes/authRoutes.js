const express = require("express");
const router = express.Router();
const {
  register,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
  verifyOtp,
  resendOtp,
  sendOtp,
  sendSetPassword,
  setPassword,
  uploadCertificate,
} = require("../controllers/authController");
const { rateLimiterForAuth } = require("../middlewares/rateLimiter");
const { requireAuth } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/requireRole");
const { upload } = require("../middlewares/upload");

router.post("/register", register);
router.post("/login", rateLimiterForAuth, login);
router.post("/refresh", refresh);
router.post("/logout", requireAuth, logout);
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.post("/verify-otp", rateLimiterForAuth, verifyOtp);
router.post("/resend-otp", rateLimiterForAuth, resendOtp);
router.post("/otp/send", rateLimiterForAuth, sendOtp);
router.post(
  "/send-set-password",
  requireAuth,
  requireRole("admin"),
  sendSetPassword
);
router.post("/set-password", rateLimiterForAuth, setPassword);

router.post("/certificate", upload.single("file"), uploadCertificate);

module.exports = router;
