// routes/clinicTaskRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const { create, listForClinic, getById, updateById } = require("../controllers/taskController")

router.post("/tasks", requireAuth, create);

router.get("/tasks", requireAuth, listForClinic);
router.get("/tasks/:id", requireAuth, requireRole(["clinic", "admin"]), getById);
router.patch("/tasks/:id", requireAuth, requireRole(["clinic", "admin"]), updateById);

module.exports = router;