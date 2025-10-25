const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const AssistantProfile = require("../models/AssistantProfile");
const Clinic = require("../models/Clinic")
const logger = require("../config/logger");
const apiError = require("../middlewares/apiError");

const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const {
  generateNumericOtp,
  hashOtp,
  getExpiryDate,
  canResend,
} = require("../config/otp");
const { sendEmailOtp, sendSmsOtp } = require("../services/commService");

const REFRESH_TOKEN_HASH_ALGO = "sha256";
const OTP_VERIFY_SECRET =
  process.env.OTP_VERIFICATION_JWT_SECRET || "change_me";
const OTP_VERIFY_TTL_MIN = parseInt(
  process.env.OTP_VERIFICATION_TTL_MINUTES || "15",
  10
);
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10);

const otpStore = new Map();
const otpKey = (channel, identifier) => `${channel}:${identifier}`;

function setOtp(channel, identifier, data) {
  otpStore.set(otpKey(channel, identifier), data);
}
function getOtp(channel, identifier) {
  return otpStore.get(otpKey(channel, identifier));
}
function delOtp(channel, identifier) {
  otpStore.delete(otpKey(channel, identifier));
}

function signVerificationToken({ channel, identifier }) {
  const payload = { ch: channel, idf: identifier };
  return jwt.sign(payload, OTP_VERIFY_SECRET, {
    expiresIn: `${OTP_VERIFY_TTL_MIN}m`,
  });
}
function verifyVerificationToken(token, expected) {
  const decoded = jwt.verify(token, OTP_VERIFY_SECRET);
  if (decoded.ch !== expected.channel || decoded.idf !== expected.identifier) {
    throw new Error("Verification token mismatch.");
  }
  return decoded;
}

function hashToken(token) {
  return crypto.createHash(REFRESH_TOKEN_HASH_ALGO).update(token).digest("hex");
}

const register = async (payload) => {
  const {
    email,
    mobile,
    first_name,
    last_name,
    clinic_name,
    address_line,
    city,
    zipcode,
    province,
    role,
    certification,
    specializations = [],
    emergency_contact = {},
    certificates = [],
    email_verification_token,
    phone_verification_token,
  } = payload;

  if(role === "assistant"){
    if (!phone_verification_token) {
      throw new Error("Verification tokens are required. Please verify phone first.");
    }

    verifyVerificationToken(phone_verification_token, { channel: "phone", identifier: mobile });
  }

  if (!email_verification_token) {
    throw new Error("Verification tokens are required. Please verify email first.");
  }

  verifyVerificationToken(email_verification_token, { channel: "email", identifier: email });

  const exists = await User.findOne({ email });

  if (exists) {
    logger.error("Email or mobile already registered");
    throw new apiError(
      409,
      "This email or phone is already registered. Please login."
    );
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
      is_verified: true,
      email_verified_at: new Date(),
      phone_verified_at: new Date(),
      verification_token: crypto.randomBytes(32).toString("hex"),
    });

    await user.save({ session });

    const certLevel = certification;

    if (role === "assistant") {
      const assistantProfile = new AssistantProfile({
        user_id: user._id,
        professional_info: {
          certification_level: certLevel,
          experience_years: 0,
          specializations: Array.isArray(specializations)
            ? specializations
            : [],
          certificates: certificates || [],
        },
        emergency_contact: {
          name: emergency_contact.name,
          relationship: emergency_contact.relationship,
          phone: emergency_contact.phone,
          email: emergency_contact.email,
        },
      });

      await assistantProfile.save({ session });
    }

    if (role === "clinic") {
      const clinic = new Clinic({
        user_id: user._id,
        clinic_name,
        address: {
          address_line,
          city,
          province,
          postal_code: zipcode,
        },
      });

      await clinic.save({ session });
    }

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
    logger.error(err);
    throw err;
  }
};

const login = async ({ email, password, ip, userAgent }) => {
  let user = await User.findOne({ email });
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

  if (!user.is_verified) {
    throw new Error("Please verify your email and phone first.");
  }
  if (user.approval_status !== "approved" || user.is_active !== true) {
    throw new Error("Account pending admin approval.");
  }

  user.login_attempts = 0;
  user.locked_until = undefined;

  let clinicData;

  if (user.role === "clinic") {
    clinicData = await Clinic.findOne({ user_id: user._id });
  }

  const payload = { sub: user._id.toString(), role: user.role, email: user.email, clinic_id: clinicData?._id || "" };
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
  const found = (user.refresh_tokens || []).find(
    (t) => t.token_hash === presentedHash
  );
  if (!found) {
    user.refresh_tokens = [];
    await user.save();
    throw new Error("Refresh token is invalid or revoked");
  }

  user.refresh_tokens = user.refresh_tokens.filter(
    (t) => t.token_hash !== presentedHash
  );

  if (user.role === "clinic") {
    clinicData = await Clinic.findOne({ user_id: user._id });
  }

  const newRefresh = createRefreshToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
    clinic_id: clinicData?._id || ""
  });
  user.refresh_tokens.push({ token_hash: hashToken(newRefresh) });
  await user.save();

  const newAccess = createAccessToken({
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
    clinic_id: clinicData?._id || ""
  });
  return { accessToken: newAccess, refreshToken: newRefresh, user };
};

const logout = async (userId, presentedRefreshToken) => {
  const user = await User.findById(userId);
  if (!user) return;
  if (!presentedRefreshToken) {
    user.refresh_tokens = [];
  } else {
    const presentedHash = hashToken(presentedRefreshToken);
    user.refresh_tokens = (user.refresh_tokens || []).filter(
      (t) => t.token_hash !== presentedHash
    );
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

const sendOtp = async ({ channel, identifier }) => {
  if (!channel || !identifier)
    throw new Error("channel and identifier are required");
  const cached = getOtp(channel, identifier);
  if (cached && !canResend(cached.lastSent)) {
    throw new Error("Please wait before requesting another OTP.");
  }

  const code = generateNumericOtp();
  const data = {
    hash: hashOtp(code),
    expires: getExpiryDate(),
    attempts: 0,
    lastSent: new Date(),
  };
  setOtp(channel, identifier, data);

  if (channel === "email") {
    await sendEmailOtp(identifier, code);
  } else if (channel === "phone") {
    await sendSmsOtp(identifier, code);
  } else {
    throw new Error("Invalid channel");
  }
  return { sent: true };
};

const resendOtp = async ({ channel, identifier }) => {
  return sendOtp({ channel, identifier });
};

const verifyOtp = async ({ channel, identifier, code }) => {
  const rec = getOtp(channel, identifier);
  if (!rec) throw new Error("No OTP found. Please request a new code.");
  if (new Date() > new Date(rec.expires)) {
    delOtp(channel, identifier);
    throw new Error("OTP expired. Please request a new code.");
  }
  if (rec.attempts >= OTP_MAX_ATTEMPTS) {
    delOtp(channel, identifier);
    throw new Error("Too many attempts. Please request a new OTP.");
  }

  const ok = rec.hash === hashOtp(code);
  if (!ok) {
    rec.attempts += 1;
    setOtp(channel, identifier, rec);
    throw new Error("Incorrect OTP.");
  }

  delOtp(channel, identifier);
  const token = signVerificationToken({ channel, identifier });
  return { verified: true, token };
};

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const SET_PW_TTL_MIN = parseInt(
  process.env.SET_PASSWORD_TOKEN_TTL_MINUTES || "60",
  10
);
const CLIENT_APP_BASE_URL =
  process.env.CLIENT_APP_BASE_URL || "http://localhost:5173";

async function sendSetPasswordEmailRaw(to, link) {
  const subject = "Set your Diarva password";
  const html = `
    <p>Hi,</p>
    <p>Your account has been approved. Please set your password by clicking the link below:</p>
    <p><a href="${link}">Set Password</a></p>
    <p>This link expires in ${SET_PW_TTL_MIN} minutes.</p>
  `;
  const code = `Use the link: ${link}`;

  await sendEmailOtp(to, code);
}

const approveUserAndSendSetPassword = async (userId, adminId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (!user.is_verified) throw new Error("User is not verified.");
  if (user.approval_status === "approved") {
    if (!user.password_hash) {
      await sendSetPasswordEmail(user._id, adminId);
    }
    return;
  }

  user.approval_status = "approved";
  user.is_active = true;
  user.approved_at = new Date();
  user.approved_by = adminId || undefined;
  await user.save();

  await sendSetPasswordEmail(user._id, adminId);
};

const rejectUser = async (userId, adminId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  user.approval_status = "rejected";
  user.is_active = false;
  user.approved_at = undefined;
  user.approved_by = adminId || undefined;
  await user.save();
  return;
};

const sendSetPasswordEmail = async (userId, adminId) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  if (user.approval_status !== "approved" || user.is_active !== true) {
    throw new Error("User must be approved and active to set password.");
  }

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(raw);
  user.set_password_token = tokenHash;
  user.set_password_expires = new Date(Date.now() + SET_PW_TTL_MIN * 60 * 1000);
  await user.save();

  const link = `${CLIENT_APP_BASE_URL}/set-password?token=${raw}`;
  await sendSetPasswordEmailRaw(user.email, link);
  logger.info(`Set password email sent to ${user.email}`);
};

const setPasswordWithToken = async (token, newPassword) => {
  if (!token || !newPassword)
    throw new Error("Token and newPassword are required");
  const tokenHash = hashToken(token);

  const user = await User.findOne({
    set_password_token: tokenHash,
    set_password_expires: { $gt: new Date() },
  });
  if (!user) throw new Error("Invalid or expired set-password token");

  await user.setPassword(newPassword);

  user.set_password_token = undefined;
  user.set_password_expires = undefined;

  await user.save();
  return { ok: true };
};

module.exports = {
  register,
  login,
  refreshTokens,
  logout,
  requestPasswordReset,
  resetPassword,
  sendOtp,
  verifyOtp,
  resendOtp,
  approveUserAndSendSetPassword,
  rejectUser,
  sendSetPasswordEmail,
  setPasswordWithToken,
};
