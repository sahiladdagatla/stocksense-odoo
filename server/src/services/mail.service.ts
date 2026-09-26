import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../lib/env.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

function printToConsole(email: string, otp: string, reason: string) {
  const rule = '='.repeat(52);
  console.log(
    [
      '',
      rule,
      ` PASSWORD RESET OTP  (${reason})`,
      ` To:  ${email}`,
      ` OTP: ${otp}   (valid for 10 minutes)`,
      rule,
      '',
    ].join('\n'),
  );
}

/**
 * Sends the password-reset OTP. If SMTP is not configured, or sending fails, the OTP is printed to
 * the server console so the reset flow always works in a demo.
 */
export async function sendOtpEmail(email: string, name: string, otp: string): Promise<void> {
  const tx = getTransporter();
  if (!tx) {
    printToConsole(email, otp, 'SMTP not configured');
    return;
  }
  try {
    await tx.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: `Your StockSense reset code: ${otp}`,
      text: `Hi ${name},\n\nYour StockSense password reset code is ${otp}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
      html: `<p>Hi ${escapeHtml(name)},</p><p>Your StockSense password reset code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>It expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
    });
  } catch (err) {
    console.error('SMTP send failed, falling back to console:', err);
    printToConsole(email, otp, 'SMTP failed');
  }
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}
