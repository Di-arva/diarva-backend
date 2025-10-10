const nodemailer = require("nodemailer");
const logger = require("../config/logger");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendVerificationEmail = async (to, token) => {
  const url = `${process.env.FRONTEND_URL || "http://localhost:3000"}/verify-email?token=${token}`;
  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to,
    subject: "Verify your email",
    text: `Verify here: ${url}`,
    html: `<p>Verify your email <a href="${url}">click here</a></p>`,
  });
  logger.info("Verification email sent: %s", info.messageId);
};

const sendPasswordResetEmail = async (to, token) => {
  const url = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to,
    subject: "Password reset",
    text: `Reset password: ${url}`,
    html: `<p>Reset password <a href="${url}">click here</a></p>`,
  });
  logger.info("Password reset email sent: %s", info.messageId);
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail };