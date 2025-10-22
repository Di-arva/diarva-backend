const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const { accept, reject, discover, applyToTask, withdraw } = require("../controllers/applicationController");

router.post("/:id/accept", requireAuth, requireRole("clinic"), accept);
router.post("/:id/reject", requireAuth, requireRole("clinic"), reject);

router.get("/tasks", requireAuth, requireRole("assistant"), discover);
router.post("/tasks/:id/apply", requireAuth, requireRole("assistant"), applyToTask);

router.post("/:id/withdraw", requireAuth, requireRole("assistant"), withdraw);

module.exports = router;