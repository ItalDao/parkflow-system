import nodemailer from 'nodemailer';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT || '587';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const secure = process.env.SMTP_SECURE === 'true' || Number(portRaw) === 465;

  const port = Number(portRaw);
  if (!host || !Number.isFinite(port) || !from) return null;

  return {
    host,
    port,
    secure,
    from,
    auth: user && pass ? { user, pass } : undefined,
  };
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const cfg = getSmtpConfig();
  if (!cfg) return null;

  cachedTransporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  });

  return cachedTransporter;
}

export function isEmailEnabled() {
  return Boolean(getSmtpConfig());
}

export async function sendTransactionalEmail(payload: EmailPayload) {
  const cfg = getSmtpConfig();
  if (!cfg) {
    return { sent: false, skipped: true, reason: 'smtp-not-configured' as const };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return { sent: false, skipped: true, reason: 'smtp-not-configured' as const };
  }

  try {
    await transporter.sendMail({
      from: cfg.from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    return { sent: true, skipped: false };
  } catch (error) {
    console.error('Email delivery failed:', error);
    return { sent: false, skipped: false, reason: 'send-failed' as const };
  }
}
