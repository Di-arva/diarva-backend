// routes/clinicTaskRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const {create, listForClinic} = require("../controllers/taskController")

router.post("/tasks", requireAuth, create);

router.get("/tasks", requireAuth, listForClinic);

module.exports = router;