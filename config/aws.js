const { SESClient } = require("@aws-sdk/client-ses");
const { SNSClient } = require("@aws-sdk/client-sns");

const awsConfiguration = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}

const ses = new SESClient(awsConfiguration);
const sns = new SNSClient(awsConfiguration);

module.exports = { ses, sns };