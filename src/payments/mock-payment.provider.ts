import { ForbiddenException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { InitInput, InitResult, PaymentProvider, WebhookResult } from './payment-provider.interface';

/**
 * Dev/test provider — lets the full payment flow run without real keys.
 * "Authorization" points back at the app, and a webhook (or the mock-complete
 * endpoint) confirms the charge. Webhooks are HMAC-signed exactly like a real
 * provider so the verification path is exercised in dev too.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  constructor(private readonly secret: string) {}

  async initialize(input: InitInput): Promise<InitResult> {
    const providerRef = `mock_${input.paymentId}`;
    const url = new URL(input.callbackUrl);
    url.searchParams.set('paymentId', input.paymentId);
    url.searchParams.set('provider', 'mock');
    return { providerRef, authorizationUrl: url.toString() };
  }

  sign(rawBody: Buffer): string {
    return createHmac('sha256', this.secret).update(rawBody).digest('hex');
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): WebhookResult {
    const expected = this.sign(rawBody);
    const a = Buffer.from(signature ?? '');
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Bad mock webhook signature');
    }
    const body = JSON.parse(rawBody.toString('utf8')) as { providerRef: string; status?: string };
    return { providerRef: body.providerRef, status: body.status === 'FAILED' ? 'FAILED' : 'SUCCESS' };
  }
}
