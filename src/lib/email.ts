import nodemailer from 'nodemailer';

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type EmailProvider = 'smtp' | 'sendgrid' | 'mailgun';

let cachedTransporter: nodemailer.Transporter | null = null;

function getEmailProvider(): EmailProvider {
  const raw = String(process.env.EMAIL_PROVIDER || 'smtp').toLowerCase();
  if (raw === 'sendgrid' || raw === 'mailgun') return raw;
  return 'smtp';
}

function getConfiguredFromAddress() {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM;
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT || '587';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = getConfiguredFromAddress();
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

function getSendgridConfig() {
  const apiKey = process.env.SENDGRID_API_KEY;
  const from = getConfiguredFromAddress();
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

function getMailgunConfig() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM || getConfiguredFromAddress();
  const region = String(process.env.MAILGUN_REGION || 'us').toLowerCase();
  if (!apiKey || !domain || !from) return null;
  const baseUrl = region === 'eu' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net';
  return { apiKey, domain, from, baseUrl };
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
  const provider = getEmailProvider();
  if (provider === 'sendgrid') return Boolean(getSendgridConfig());
  if (provider === 'mailgun') return Boolean(getMailgunConfig());
  return Boolean(getSmtpConfig());
}

export async function sendTransactionalEmail(payload: EmailPayload) {
  const provider = getEmailProvider();

  if (provider === 'sendgrid') {
    const cfg = getSendgridConfig();
    if (!cfg) {
      return { sent: false, skipped: true, reason: 'sendgrid-not-configured' as const };
    }

    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: payload.to }] }],
          from: { email: cfg.from },
          subject: payload.subject,
          content: [
            { type: 'text/plain', value: payload.text },
            ...(payload.html ? [{ type: 'text/html', value: payload.html }] : []),
          ],
        }),
      });

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        console.error('SendGrid delivery failed:', response.status, details);
        return { sent: false, skipped: false, reason: 'send-failed' as const };
      }

      return { sent: true, skipped: false };
    } catch (error) {
      console.error('SendGrid delivery failed:', error);
      return { sent: false, skipped: false, reason: 'send-failed' as const };
    }
  }

  if (provider === 'mailgun') {
    const cfg = getMailgunConfig();
    if (!cfg) {
      return { sent: false, skipped: true, reason: 'mailgun-not-configured' as const };
    }

    try {
      const body = new URLSearchParams();
      body.set('from', cfg.from);
      body.set('to', payload.to);
      body.set('subject', payload.subject);
      body.set('text', payload.text);
      if (payload.html) body.set('html', payload.html);

      const auth = Buffer.from(`api:${cfg.apiKey}`).toString('base64');
      const response = await fetch(`${cfg.baseUrl}/v3/${cfg.domain}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!response.ok) {
        const details = await response.text().catch(() => '');
        console.error('Mailgun delivery failed:', response.status, details);
        return { sent: false, skipped: false, reason: 'send-failed' as const };
      }

      return { sent: true, skipped: false };
    } catch (error) {
      console.error('Mailgun delivery failed:', error);
      return { sent: false, skipped: false, reason: 'send-failed' as const };
    }
  }

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
    console.error('SMTP delivery failed:', error);
    return { sent: false, skipped: false, reason: 'send-failed' as const };
  }
}
