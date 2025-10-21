const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middlewares/auth");
const adminController = require("../controllers/adminController");

router.post("/users/:id/approve", requireAuth, requireRole("admin"), adminController.approveUser);
router.put("/users/:id/approve",  requireAuth, requireRole("admin"), adminController.approveUser);

router.post("/users/:id/reject",  requireAuth, requireRole("admin"), adminController.rejectUser);
router.put("/users/:id/reject",   requireAuth, requireRole("admin"), adminController.rejectUser);

router.get("/users", requireAuth, requireRole("admin"), adminController.listUsers);
router.get("/users/:id", requireAuth, requireRole("admin"), adminController.getUser);
router.patch("/users/:id/status", requireAuth, requireRole("admin"), adminController.setUserStatus);


router.get("/__health", (req, res) => res.json({ ok: true, scope: "admin" }));

module.exports = router;