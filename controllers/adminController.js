const authService = require("../services/authService");
const logger = require("../config/logger");

const approveUser = async (req, res, next) => {
  try {
    const adminId = req.user?.sub;
    const userId = req.params.id;
    await authService.approveUserAndSendSetPassword(userId, adminId);
    res.json({ success: true, message: "User approved and set-password email sent." });
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

module.exports = { approveUser, rejectUser };
