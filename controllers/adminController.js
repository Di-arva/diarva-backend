const authService = require("../services/authService");
const adminService = require("../services/adminService");
const logger = require("../config/logger");

const approveUser = async (req, res, next) => {
  try {
    const adminId = req.user?.sub;
    const userId = req.params.id;
    await authService.approveUserAndSendSetPassword(userId, adminId);
    res.json({
      success: true,
      message: "User approved and set-password email sent.",
    });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

const rejectUser = async (req, res, next) => {
  try {
    const adminId = req.user?.sub;
    const userId = req.params.id;
    await authService.rejectUser(userId, adminId);
    res.json({ success: true, message: "User rejected." });
  } catch (err) {
    next(err);
  }
};

const listUsers = async (req, res, next) => {
  try {
    const { role, approval_status, is_active, page, limit } = req.query;
    const filters = { role, approval_status, is_active };
    const pagination = { page, limit };
    const result = await adminService.listUsers(filters, pagination);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

const getUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const data = await adminService.getUserDetails(userId);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "User not found." });
    }
    res.json({ success: true, data });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

const setUserStatus = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { isActive } = req.body;
    const adminId = req.user?.sub;

    if (typeof isActive !== "boolean") {
      return res
        .status(400)
        .json({ success: false, message: "'isActive' must be a boolean." });
    }

    const result = await adminService.setUserStatus(userId, isActive, adminId);
    res.json({
      success: true,
      message: `User status updated to ${isActive ? "active" : "inactive"}.`,
      data: result,
    });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const data = await adminService.getAnalytics();
    res.json({ success: true, data });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

module.exports = { approveUser, rejectUser, listUsers, getUser, setUserStatus, getAnalytics };