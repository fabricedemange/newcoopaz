#!/usr/bin/env node
import "dotenv/config";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const {
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  AWS_REGION = "eu-west-1",
  SES_FROM,
  SES_TO,
} = process.env;

const missing = [
  ["AWS_ACCESS_KEY_ID", AWS_ACCESS_KEY_ID],
  ["AWS_SECRET_ACCESS_KEY", AWS_SECRET_ACCESS_KEY],
  ["SES_FROM", SES_FROM],
  ["SES_TO", SES_TO],
].filter(([, value]) => !value);

if (missing.length) {
  console.error("Missing environment variables:", missing.map(([key]) => key).join(", "));
  console.error("Update your .env file then retry.");
  process.exit(1);
}

const client = new SESv2Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

async function sendEmail() {
  const params = {
    FromEmailAddress: SES_FROM,
    Destination: {
      ToAddresses: SES_TO.split(",").map((entry) => entry.trim()).filter(Boolean),
    },
    Content: {
      Simple: {
        Subject: { Data: "Test AWS SES" },
        Body: {
          Text: { Data: "Hello from AWS SES via @aws-sdk/client-sesv2" },
        },
      },
    },
  };

  console.log("Sending email with AWS SES...");
  console.log(`Region: ${AWS_REGION}`);
  console.log(`From:   ${SES_FROM}`);
  console.log(`To:     ${params.Destination.ToAddresses.join(", ")}`);

  try {
    const response = await client.send(new SendEmailCommand(params));
    console.log("Email sent.");
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error("Send failed:");
    if (error && error.stack) {
      console.error(error.stack);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  }
}

sendEmail();
