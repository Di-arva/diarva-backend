const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const { listForClinic, listForAssistant } = require("../controllers/workHistoryController");

router.get("/clinic", requireAuth, requireRole("clinic"), listForClinic);
router.get("/assistant", requireAuth, requireRole("assistant"), listForAssistant);

module.exports = router;