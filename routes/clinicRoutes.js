// routes/clinicTaskRoutes.js
const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middlewares/auth");
const {create} = require("../controllers/taskController")

router.post("/tasks", requireAuth, create);

module.exports = router;