const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const { create, listForClinic, getById, updateById, cancelById } = require("../controllers/taskController");

const { listForTask, getAllClinicApplicants } = require("../controllers/applicationController");

router.post("/tasks", requireAuth, requireRole(["clinic", "admin"]), create);
router.get("/tasks", requireAuth, requireRole(["clinic", "admin"]), listForClinic);
router.get("/tasks/:id", requireAuth, requireRole(["clinic", "admin"]), getById);
router.patch("/tasks/:id", requireAuth, requireRole(["clinic", "admin"]), updateById);
router.patch("/tasks/:id/cancel", requireAuth, requireRole(["clinic", "admin"]), cancelById);
router.get("/applicants/all", requireAuth, requireRole(["clinic", "admin"]), getAllClinicApplicants);
router.get("/tasks/:id/applications", requireAuth, requireRole(["clinic", "admin"]), listForTask);

module.exports = router;