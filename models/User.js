const mongoose = require("mongoose");
const bcrypt = require("bcrypt")

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    mobile: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password_hash: {
      type: String,
      minlength: 60,
    },
    first_name: { type: String, required: true, trim: true, maxlength: 50 },
    last_name: { type: String, required: true, trim: true, maxlength: 50 },
    city: { type: String, required: true, trim: true },
    zipcode: {
      type: String,
      required: true,
      match: [/^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, "Invalid postal code"],
      uppercase: true,
    },
    province: {
      type: String,
      required: true,
      enum: ["AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK", "NT", "NU", "YT"],
    },
    role: {
      type: String,
      enum: ["clinic", "admin", "assistant"],
      required: true,
    },
    profile_picture: {
      url: String,
      public_id: String,
    },
    is_active: { type: Boolean, default: true },
    is_verified: { type: Boolean, default: false },
    email_verified_at: Date,
    phone_verified_at: Date,

    email_otp_hash: String,
    email_otp_expires: Date,

    phone_otp_hash: String,
    phone_otp_expires: Date,

    otp_attempts: { type: Number, default: 0 },
    otp_last_sent_at: Date,
    verification_token: String,
    password_reset_token: String,
    password_reset_expires: Date,
    set_password_token: String,
    set_password_expires: Date,
    last_login: Date,
    login_attempts: { type: Number, default: 0 },
    locked_until: Date,
    refresh_tokens: [
      {
        token_hash: String,
        created_at: { type: Date, default: Date.now },
        ip: String,
        user_agent: String,
      },
    ],
    approval_status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    approved_at: Date,
    approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    preferences: {
      language: { type: String, enum: ["en", "fr"], default: "en" },
      timezone: { type: String, default: "America/Toronto" },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true }
);

userSchema.methods.isPasswordMatch = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password_hash);
};

userSchema.methods.setPassword = async function (plainPassword) {
  const saltRounds = 12;
  const hash = await bcrypt.hash(plainPassword, saltRounds);
  this.password_hash = hash;
};

userSchema.index({ role: 1, is_active: 1 });
userSchema.index({ city: 1, province: 1 });

const User = mongoose.model("User", userSchema);
module.exports = User;