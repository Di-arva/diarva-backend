// routes/adminRoutes.js
const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middlewares/auth");
const { requireRole } = require("../middlewares/requireRole");
const adminController = require("../controllers/adminController");

router.post("/users/:id/approve", requireAuth, requireRole("admin"), adminController.approveUser);
router.put("/users/:id/approve",  requireAuth, requireRole("admin"), adminController.approveUser);

router.post("/users/:id/reject",  requireAuth, requireRole("admin"), adminController.rejectUser);
router.put("/users/:id/reject",   requireAuth, requireRole("admin"), adminController.rejectUser);

router.get("/__health", (req, res) => res.json({ ok: true, scope: "admin" }));

module.exports = router;