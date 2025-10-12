const { ses, sns } = require("../config/aws");
const { SendEmailCommand } = require("@aws-sdk/client-ses");
const { PublishCommand } = require("@aws-sdk/client-sns");

async function sendEmailOtp(to, code) {
  const from = process.env.SES_FROM_EMAIL;
  const subject = "Your Diarva verification code";
  const html = `<p>Your Diarva verification code is <b>${code}</b>. It expires in ${process.env.OTP_TTL_MINUTES || 10} minutes.</p>`;
  const text = `Your Diarva verification code is ${code}. It expires in ${process.env.OTP_TTL_MINUTES || 10} minutes.`;

  const cmd = new SendEmailCommand({
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: html }, Text: { Data: text } },
    },
    Source: from,
  });

  await ses.send(cmd);
}

async function sendSmsOtp(toE164, code) {
  // toE164 e.g., "+14165550123"
  const msg = `Diarva code: ${code}. Expires in ${process.env.OTP_TTL_MINUTES || 10} min.`;
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
  await sns.send(cmd);
}

module.exports = { sendEmailOtp, sendSmsOtp };