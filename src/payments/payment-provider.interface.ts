export interface InitInput {
  paymentId: string;
  amountKobo: number;
  currency: string;
  email: string;
  callbackUrl: string;
}

export interface InitResult {
  providerRef: string;
  authorizationUrl: string;
}

export interface WebhookResult {
  providerRef: string;
  status: 'SUCCESS' | 'FAILED';
}

/**
 * Payment seam. Swap providers via PAYMENT_PROVIDER env without touching
 * PaymentsService. `mock` lets the whole flow run in dev with no keys;
 * `paystack` is the real implementation (Flutterwave/Stripe follow the same shape).
 */
export interface PaymentProvider {
  readonly name: string;
  initialize(input: InitInput): Promise<InitResult>;
  /** Verify a webhook's signature and return the outcome. Throws if invalid. */
  verifyWebhook(rawBody: Buffer, signature: string | undefined): WebhookResult;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
