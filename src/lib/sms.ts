function normalizePhone(rawPhone: string) {
  const cleaned = rawPhone.replace(/[\s()-]/g, '');
  if (!cleaned) return null;

  if (cleaned.startsWith('+')) return cleaned;

  const defaultCountryCode = process.env.SMS_DEFAULT_COUNTRY_CODE || '+57';
  if (/^\d{10}$/.test(cleaned)) return `${defaultCountryCode}${cleaned}`;
  if (/^\d{11,15}$/.test(cleaned)) return `+${cleaned}`;

  return null;
}

export async function sendTransactionalSms(params: { to: string; body: string }) {
  const provider = (process.env.SMS_PROVIDER || '').trim().toLowerCase() || 'none';
  if (provider !== 'twilio') {
    return { sent: false, skipped: true, reason: 'sms-provider-disabled' as const };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    return { sent: false, skipped: true, reason: 'twilio-missing-config' as const };
  }

  const to = normalizePhone(params.to);
  if (!to) {
    return { sent: false, skipped: true, reason: 'invalid-destination-phone' as const };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: params.body.slice(0, 1400),
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown');
    throw new Error(`Twilio SMS error (${response.status}): ${errorText}`);
  }

  const result = (await response.json().catch(() => ({}))) as { sid?: string };
  return { sent: true, provider: 'twilio' as const, sid: result.sid || null };
}
