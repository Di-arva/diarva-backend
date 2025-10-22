const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middlewares/auth");
const { approveUser, rejectUser, listUsers, getUser, setUserStatus, getAnalytics } = require("../controllers/adminController");

// Analytics
router.get("/analytics", requireAuth, requireRole("admin"), getAnalytics);

// User Approval
router.post("/users/:id/approve", requireAuth, requireRole("admin"), approveUser);
router.put("/users/:id/approve",  requireAuth, requireRole("admin"), approveUser);

router.post("/users/:id/reject",  requireAuth, requireRole("admin"), rejectUser);
router.put("/users/:id/reject",   requireAuth, requireRole("admin"), rejectUser);

// User Management
router.get("/users", requireAuth, requireRole("admin"), listUsers);
router.get("/users/:id", requireAuth, requireRole("admin"), getUser);
router.patch("/users/:id/status", requireAuth, requireRole("admin"), setUserStatus);


router.get("/__health", (req, res) => res.json({ ok: true, scope: "admin" }));

module.exports = router;