const express = require("express");
const router = express.Router();
const {register, login,refresh, logout, requestPasswordReset, resetPassword} = require("../controllers/authController");
const { rateLimiterForAuth } = require("../middlewares/rateLimiter");
const { requireAuth } = require("../middlewares/auth");

router.post("/register", register);
router.post("/login", rateLimiterForAuth, login);
router.post("/refresh", refresh);
router.post("/logout", requireAuth, logout);

router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);

module.exports = router;