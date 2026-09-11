import nodemailer from "nodemailer";
import type { Settings } from "@prisma/client";

export async function sendEmail(
  settings: Settings,
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<{ success: boolean; error?: string }> {
  if (!settings.smtpHost || !settings.smtpFrom) {
    return { success: false, error: "SMTP not configured" };
  }

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort ?? 587,
    secure: settings.smtpSecure,
    auth:
      settings.smtpUser && settings.smtpPass
        ? { user: settings.smtpUser, pass: settings.smtpPass }
        : undefined,
  });

  try {
    await transporter.sendMail({
      from: settings.smtpFrom,
      to,
      subject,
      text,
      html: html ?? `<div style="font-family:sans-serif;white-space:pre-wrap">${text}</div>`,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
