const authService = require("../services/authService");
const logger = require("../config/logger");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../utils/email");

const register = async (req, res, next) => {
  try {
    const { password, ...rest } = req.body;
    if (!password) return res.status(400).json({ success: false, message: "Password required" });
    const { user, verificationToken } = await authService.register({ ...rest, password });
    sendVerificationEmail(user.email, verificationToken).catch((err) => logger.error(err));
    res.status(201).json({ success: true, data: { id: user._id, email: user.email } });
  } catch (err) {
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

    res.json({ success: true, data: { accessToken, user: { id: user._id, email: user.email, role: user.role } } });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies || {};
    if (!refreshToken) return res.status(401).json({ success: false, message: "No refresh token" });
    const { accessToken, refreshToken: newRefresh, user } = await authService.refreshTokens(refreshToken);

    res.cookie("refreshToken", newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, data: { accessToken, user: { id: user._id, role: user.role } } });
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

module.exports = {
  register,
  login,
  refresh,
  logout,
  requestPasswordReset,
  resetPassword,
};