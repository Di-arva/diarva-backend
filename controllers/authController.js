const authService = require("../services/authService");
const logger = require("../config/logger");
const { sendPasswordResetEmail } = require("../utils/email");
const { uploadCertificateToS3 } = require("../services/commService");

const register = async (req, res, next) => {
  logger.info(`authController register: ${req.body.email}`);
  try {
    const result = await authService.register({
      email: req.body.email,
      mobile: req.body.mobile,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      city: req.body.city,
      zipcode: req.body.zipcode,
      province: req.body.province,
      role: "assistant",

      certification: req.body.certification,
      specializations: req.body.specializations || [],
      emergency_contact: req.body.emergency_contact || {},

      email_verification_token: req.body.email_verification_token,
      phone_verification_token: req.body.phone_verification_token,
    });

    return res.status(201).json({
      success: true,
      message: "Registration submitted. Pending admin approval.",
      data: result,
    });
  } catch (err) {
    // handle known register errors

    logger.error(err);
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const ip = req.ip;
    const userAgent = req.get("User-Agent");
    const { user, accessToken, refreshToken } = await authService.login({
      emailOrMobile: identifier,
      password,
      ip,
      userAgent,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: {
        accessToken,
        user: { id: user._id, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies || {};
    if (!refreshToken)
      return res
        .status(401)
        .json({ success: false, message: "No refresh token" });
    const {
      accessToken,
      refreshToken: newRefresh,
      user,
    } = await authService.refreshTokens(refreshToken);

    res.cookie("refreshToken", newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      data: { accessToken, user: { id: user._id, role: user.role } },
    });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const userId = req.user && req.user.sub;
    const { refreshToken } = req.cookies || {};
    await authService.logout(userId, refreshToken);
    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    next(err);
  }
};

const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body;
    const token = await authService.requestPasswordReset(email);
    sendPasswordResetEmail(email, token).catch((err) => logger.error(err));
    res.json({ success: true, message: "Password reset email sent" });
  } catch (err) {
    next(err);
  }
};

const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);
    res.json({ success: true, message: "Password updated" });
  } catch (err) {
    next(err);
  }
};

/** =======================
 *  Pre-registration OTP
 *  ======================= */
const sendOtp = async (req, res, next) => {
  try {
    const { channel, identifier } = req.body;
    await authService.sendOtp({ channel, identifier });
    res.json({ success: true, message: "OTP sent." });
  } catch (err) {
    next(err);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { channel, identifier, code } = req.body;
    const result = await authService.verifyOtp({ channel, identifier, code });
    res.json({ success: true, data: result });
  } catch (err) {
    // handle known OTP errors
    const otpErrors = [
      "No OTP found. Please request a new code.",
      "OTP expired. Please request a new code.",
      "Too many attempts. Please request a new OTP.",
      "Incorrect OTP.",
    ];

    if (otpErrors.includes(err.message)) {
      return res.status(400).json({ success: false, message: err.message });
    }

    next(err);
  }
};

const resendOtp = async (req, res, next) => {
  try {
    const { channel, identifier } = req.body;
    const result = await authService.resendOtp({ channel, identifier });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const sendSetPassword = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const adminId = req.user?.sub;
    await authService.sendSetPasswordEmail(userId, adminId);
    res.json({ success: true, message: "Set-password email sent." });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

const setPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    await authService.setPasswordWithToken(token, newPassword);
    res.json({
      success: true,
      message: "Password set successfully. You can now log in.",
    });
  } catch (err) {
    logger.error(err);
    next(err);
  }
};

const uploadCertificate = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const url = await uploadCertificateToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    return res.status(200).json({
      success: true,
      url,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
  sendOtp,
  verifyOtp,
  resendOtp,
  sendSetPassword,
  setPassword,
  uploadCertificate,
};
