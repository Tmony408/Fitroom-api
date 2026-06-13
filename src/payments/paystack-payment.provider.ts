import { BadGatewayException, ForbiddenException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { InitInput, InitResult, PaymentProvider, WebhookResult } from './payment-provider.interface';

/**
 * Real Paystack provider (fetch-based — no SDK dependency).
 * Enabled by PAYMENT_PROVIDER=paystack + PAYSTACK_SECRET_KEY.
 * Webhooks are verified with HMAC-SHA512 over the raw body (Paystack spec).
 */
export class PaystackPaymentProvider implements PaymentProvider {
  readonly name = 'paystack';
  constructor(private readonly secretKey: string) {}

  async initialize(input: InitInput): Promise<InitResult> {
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo, // Paystack expects the minor unit (kobo)
        currency: input.currency,
        reference: input.paymentId,
        callback_url: input.callbackUrl,
      }),
    });
    const json = (await res.json()) as {
      status: boolean;
      message: string;
      data?: { reference: string; authorization_url: string };
    };
    if (!res.ok || !json.status || !json.data) {
      throw new BadGatewayException(`Paystack init failed: ${json.message ?? res.statusText}`);
    }
    return { providerRef: json.data.reference, authorizationUrl: json.data.authorization_url };
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined): WebhookResult {
    const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
    const a = Buffer.from(signature ?? '');
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('Invalid Paystack signature');
    }
    const body = JSON.parse(rawBody.toString('utf8')) as {
      event: string;
      data: { reference: string };
    };
    return {
      providerRef: body.data.reference,
      status: body.event === 'charge.success' ? 'SUCCESS' : 'FAILED',
    };
  }
}
