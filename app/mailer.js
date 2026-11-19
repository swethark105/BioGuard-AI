// Sends email through SMTP. In Docker and CI the SMTP server is Mailpit, a
// fake inbox: emails never leave the machine, and tests read them through
// Mailpit's API. Locally, start Mailpit and the defaults below just work.
import nodemailer from 'nodemailer';

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
  ignoreTLS: true
});

export async function sendEmail({ to, subject, text }) {
  await transport.sendMail({ from: 'BioGuard AI <no-reply@bioguard.test>', to, subject, text });
}
