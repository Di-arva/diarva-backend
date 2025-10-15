const { ses, sns, s3 } = require("../config/aws");
const { SendEmailCommand } = require("@aws-sdk/client-ses");
const { PublishCommand } = require("@aws-sdk/client-sns");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const crypto = require("crypto");
const path = require("path");

const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION 

async function uploadCertificateToS3(fileBuffer, originalName, mimetype) {
  const ext = path.extname(originalName);                    
  const key = `certificates/${crypto.randomBytes(16).toString("hex")}${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: mimetype,
  });

  await s3.send(command);

  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
  replyTo,
  cc,
  bcc,
}) {
  if (!to || !subject || (!html && !text)) {
    throw new Error("sendEmail requires 'to', 'subject', and ('html' or 'text').");
  }

  const Source = from || process.env.SES_FROM_EMAIL;
  if (!Source) throw new Error("SES_FROM_EMAIL not configured.");

  const toArr = Array.isArray(to) ? to : [to];
  const ccArr = cc ? (Array.isArray(cc) ? cc : [cc]) : undefined;
  const bccArr = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined;
  const replyToArr = replyTo ? (Array.isArray(replyTo) ? replyTo : [replyTo]) : undefined;

  const cmd = new SendEmailCommand({
    Source,
    Destination: {
      ToAddresses: toArr,
      CcAddresses: ccArr,
      BccAddresses: bccArr,
    },
    ReplyToAddresses: replyToArr,
    Message: {
      Subject: { Data: subject },
      Body: {
        ...(html ? { Html: { Data: html } } : {}),
        ...(text ? { Text: { Data: text } } : {}),
      },
    },
  });

  return ses.send(cmd);
}

async function sendEmailOtp(to, code) {
  const ttl = process.env.OTP_TTL_MINUTES || 10;
  const subject = "Your Diarva verification code";
  const html = `<p>Your Diarva verification code is <b>${code}</b>. It expires in ${ttl} minutes.</p>`;
  const text = `Your Diarva verification code is ${code}. It expires in ${ttl} minutes.`;
  return sendEmail({ to, subject, html, text });
}

async function sendSmsOtp(toE164, code) {
  const ttl = process.env.OTP_TTL_MINUTES || 10;
  const msg = `Diarva code: ${code}. Expires in ${ttl} min.`;
  const cmd = new PublishCommand({
    Message: msg,
    PhoneNumber: toE164,
    MessageAttributes: {
      "AWS.SNS.SMS.SenderID": {
        DataType: "String",
        StringValue: process.env.SMS_SENDER_ID || "DIARVA",
      },
      "AWS.SNS.SMS.SMSType": { DataType: "String", StringValue: "Transactional" },
    },
  });
  return sns.send(cmd);
}

async function sendSetPasswordEmail(to, link, ttlMinutes) {
  const ttl = ttlMinutes || process.env.SET_PASSWORD_TOKEN_TTL_MINUTES || 60;
  const subject = "Set your Diarva password";
  const html = `
    <p>Hi,</p>
    <p>Your account has been approved. Please set your password by clicking the link below:</p>
    <p><a href="${link}">Set Password</a></p>
    <p>This link expires in ${ttl} minutes.</p>
  `;
  const text = `Your account has been approved. Set your password: ${link} (expires in ${ttl} minutes)`;
  return sendEmail({ to, subject, html, text });
}

module.exports = {
  sendEmail,
  sendEmailOtp,
  sendSetPasswordEmail,
  sendSmsOtp,
  uploadCertificateToS3
};