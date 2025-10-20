const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const applicationController = require("../controllers/applicationController");

router.post("/:id/accept", requireAuth, requireRole("clinic"), applicationController.accept);
router.post("/:id/reject", requireAuth, requireRole("clinic"), applicationController.reject);

router.get("/tasks", requireAuth, requireRole("assistant"), applicationController.discover);
router.post("/tasks/:id/apply", requireAuth, requireRole("assistant"), applicationController.applyToTask);

router.post("/:id/withdraw", requireAuth, requireRole("assistant"), applicationController.withdraw);

module.exports = router;