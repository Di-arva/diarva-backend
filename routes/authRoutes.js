const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { rateLimiterForAuth } = require("../middlewares/rateLimiter");
const { requireAuth } = require("../middlewares/auth");

router.post("/register", authController.register);
router.post("/login", rateLimiterForAuth, authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", requireAuth, authController.logout);

router.post("/request-password-reset", authController.requestPasswordReset);
router.post("/reset-password", authController.resetPassword);

module.exports = router;