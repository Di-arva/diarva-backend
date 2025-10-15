module.exports.requireRole = (...allowed) => (req, res, next) => {
  try {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  } catch (e) {
    next(e);
  }
};
