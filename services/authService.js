const crypto = require("crypto");
const User = require("../models/User");
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const mongoose = require("mongoose");
const AssistantProfile = require("../models/AssistantProfile");
const logger = require("../config/logger");

const REFRESH_TOKEN_HASH_ALGO = "sha256";

function hashToken(token) {
  return crypto.createHash(REFRESH_TOKEN_HASH_ALGO).update(token).digest("hex");
}

const register = async (payload) => {
  const {
    email, mobile, first_name, last_name, city, zipcode, province,
    role,
    certification,
    specializations = [],
    emergency_contact = {},
  } = payload;

  const exists = await User.findOne({ $or: [{ email }, { mobile }] });
  if (exists) {
    logger.error("Email or mobile already registered")
    throw new Error("Email or mobile already registered");
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = new User({
      email,
      mobile,
      first_name,
      last_name,
      city,
      zipcode,
      province,
      role,
      is_active: false,
      approval_status: "pending",
      is_verified: false,
      verification_token: crypto.randomBytes(32).toString("hex"),
    });

    await user.save({ session });

    const certLevel = certification;
    const specSet = new Set(specializations);
    if (harpCertified) specSet.add("Dental Radiography");

    const assistantProfile = new AssistantProfile({
      user_id: user._id,
      professional_info: {
        certification_level: certLevel,
        experience_years: 0,
        specializations: Array.from(specSet),
      },
      emergency_contact: {
        name: emergency_contact.name,
        relationship: emergency_contact.relationship,
        phone: emergency_contact.phone,
        email: emergency_contact.email,
      },
    });

    await assistantProfile.save({ session });

    await session.commitTransaction();
    session.endSession();

    return {
      userId: user._id,
      email: user.email,
      approval_status: user.approval_status,
    };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    logger.error(err)
    throw err;
  }
};

const login = async ({ emailOrMobile, password, ip, userAgent }) => {
  const user = await User.findOne({
    $or: [{ email: emailOrMobile }, { mobile: emailOrMobile }],
  });
  if (!user) throw new Error("Invalid credentials");

  if (user.locked_until && user.locked_until > new Date()) {
    const waitSec = Math.ceil((user.locked_until - new Date()) / 1000);
    throw new Error(`Account locked. Try again in ${waitSec} seconds`);
  }

  const match = await user.isPasswordMatch(password);
  if (!match) {
    user.login_attempts = (user.login_attempts || 0) + 1;
    if (user.login_attempts >= 5) {
      user.locked_until = new Date(Date.now() + 30 * 60 * 1000);
      user.login_attempts = 0;
    }
    await user.save();
    throw new Error("Invalid credentials");
  }

  user.login_attempts = 0;
  user.locked_until = undefined;

  const payload = { sub: user._id.toString(), role: user.role };
  const accessToken = createAccessToken(payload);
  const refreshToken = createRefreshToken(payload);

  user.refresh_tokens = user.refresh_tokens || [];
  user.refresh_tokens.push({
    token_hash: hashToken(refreshToken),
    ip,
    user_agent: userAgent,
  });

  await user.save();

  return { user, accessToken, refreshToken };
};

const refreshTokens = async (presentedToken) => {
  const decoded = verifyRefreshToken(presentedToken);
  const userId = decoded.sub;
  const user = await User.findById(userId);
  if (!user) throw new Error("Invalid refresh token");

  const presentedHash = hashToken(presentedToken);
  const found = user.refresh_tokens.find((t) => t.token_hash === presentedHash);
  if (!found) {
    user.refresh_tokens = [];
    await user.save();
    throw new Error("Refresh token is invalid or revoked");
  }

  user.refresh_tokens = user.refresh_tokens.filter((t) => t.token_hash !== presentedHash);
  const newRefresh = createRefreshToken({ sub: user._id.toString(), role: user.role });
  user.refresh_tokens.push({ token_hash: hashToken(newRefresh) });
  await user.save();

  const newAccess = createAccessToken({ sub: user._id.toString(), role: user.role });
  return { accessToken: newAccess, refreshToken: newRefresh, user };
};

const logout = async (userId, presentedRefreshToken) => {
  const user = await User.findById(userId);
  if (!user) return;
  if (!presentedRefreshToken) {
    user.refresh_tokens = [];
  } else {
    const presentedHash = hashToken(presentedRefreshToken);
    user.refresh_tokens = user.refresh_tokens.filter((t) => t.token_hash !== presentedHash);
  }
  await user.save();
  return;
};

const requestPasswordReset = async (email) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("User not found");
  const token = crypto.randomBytes(32).toString("hex");
  user.password_reset_token = hashToken(token);
  user.password_reset_expires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();
  return token;
};

const resetPassword = async (token, newPassword) => {
  const tokenHash = hashToken(token);
  const user = await User.findOne({
    password_reset_token: tokenHash,
    password_reset_expires: { $gt: new Date() },
  });
  if (!user) throw new Error("Invalid or expired password reset token");
  await user.setPassword(newPassword);
  user.password_reset_token = undefined;
  user.password_reset_expires = undefined;
  await user.save();
  return user;
};

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  requestPasswordReset,
  resetPassword,
};