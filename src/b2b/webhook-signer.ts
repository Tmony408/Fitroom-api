import { createHmac } from 'crypto';

/**
 * Signs outgoing B2B fit-event webhooks so partners can verify authenticity.
 * Header `x-fitroom-signature: t=<ts>,v1=<hmac>` over `<ts>.<rawBody>`
 * (Stripe-style), keyed by the partner's webhook secret.
 */
export function signWebhook(secret: string, rawBody: string, timestamp = Date.now()): string {
  const sig = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

export function verifyWebhook(secret: string, rawBody: string, header: string, toleranceMs = 5 * 60_000): boolean {
  const parts = Object.fromEntries((header ?? '').split(',').map((kv) => kv.split('=')));
  const ts = Number(parts.t);
  if (!ts || Math.abs(Date.now() - ts) > toleranceMs) return false;
  const expected = createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  return parts.v1 === expected;
}
