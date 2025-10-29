const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const { create, listForClinic, getById, updateById, cancelById } = require("../controllers/taskController");

const { listForTask, getAllClinicApplicants } = require("../controllers/applicationController");
const { getProfile, updateProfile,getPublicProfile } = require("../controllers/clinicProfileController"); 
const Clinic = require("../models/Clinic"); 





router.post("/tasks", requireAuth, requireRole(["clinic", "admin"]), create);
router.get("/tasks", requireAuth, requireRole(["clinic", "admin"]), listForClinic);
router.get("/tasks/:id", requireAuth, requireRole(["clinic", "admin"]), getById);
router.patch("/tasks/:id", requireAuth, requireRole(["clinic", "admin"]), updateById);
router.patch("/tasks/:id/cancel", requireAuth, requireRole(["clinic", "admin"]), cancelById);
router.get("/applicants/all", requireAuth, requireRole(["clinic", "admin"]), getAllClinicApplicants);
router.get("/tasks/:id/applications", requireAuth, requireRole(["clinic", "admin"]), listForTask);

// New clinic profile routes
router.get("/profile", requireAuth, requireRole(["clinic", "admin"]), getProfile);
router.put("/profile", requireAuth, requireRole(["clinic", "admin"]), updateProfile);
router.get("/profile/public/:clinicId", getPublicProfile);

module.exports = router;