const { SESClient } = require("@aws-sdk/client-ses");
const { SNSClient } = require("@aws-sdk/client-sns");
const { S3Client} = require("@aws-sdk/client-s3")

const awsConfiguration = {
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
}

const ses = new SESClient(awsConfiguration);
const sns = new SNSClient(awsConfiguration);
const s3 = new S3Client(awsConfiguration);

module.exports = { ses, sns, s3 };