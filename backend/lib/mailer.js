// backend/lib/mailer.js
import nodemailer from "nodemailer";

let transporterPromise;

export function getMailer() {
  if (!transporterPromise) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } =
      process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      throw new Error("SMTP env not set");
    }
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT || 465),
        secure: String(SMTP_SECURE).toLowerCase() === "true",
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    );
  }
  return transporterPromise;
}
