const crypto = require("crypto");

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || "6", 10);
const OTP_TTL_MINUTES = parseInt(process.env.OTP_TTL_MINUTES || "10", 10);
const RESEND_COOLDOWN = parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS || "60", 10);

function generateNumericOtp(len = OTP_LENGTH) {
  const digits = "0123456789";
  let code = "";
  for (let i = 0; i < len; i++) code += digits[Math.floor(Math.random() * 10)];
  return code;
}

function hashOtp(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function getExpiryDate() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

function canResend(lastSentAt) {
  if (!lastSentAt) return true;
  return Date.now() - new Date(lastSentAt).getTime() > RESEND_COOLDOWN * 1000;
}

module.exports = { generateNumericOtp, hashOtp, getExpiryDate, canResend };