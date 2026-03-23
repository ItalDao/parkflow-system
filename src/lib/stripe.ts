import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function isStripeEnabled() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (stripeClient) return stripeClient;

  stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  return stripeClient;
}

export function toStripeAmount(amount: number, currency = 'cop') {
  const zeroDecimalCurrencies = new Set(['bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf', 'cop']);
  const c = currency.toLowerCase();
  if (zeroDecimalCurrencies.has(c)) return Math.max(0, Math.round(amount));
  return Math.max(0, Math.round(amount * 100));
}
