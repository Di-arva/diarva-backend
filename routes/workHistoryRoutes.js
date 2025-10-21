const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const workHistoryController = require("../controllers/workHistoryController");

// Scoped routes for different roles
router.get("/clinic", requireAuth, requireRole("clinic"), workHistoryController.listForClinic);
router.get("/assistant", requireAuth, requireRole("assistant"), workHistoryController.listForAssistant);

module.exports = router;