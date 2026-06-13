import { createHmac } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaystackPaymentProvider } from './paystack-payment.provider';

describe('MockPaymentProvider webhook', () => {
  const p = new MockPaymentProvider('test-secret');

  it('initialize returns a ref + callback URL carrying the paymentId', async () => {
    const r = await p.initialize({
      paymentId: 'pay_1', amountKobo: 5000, currency: 'NGN',
      email: 'a@b.co', callbackUrl: 'http://localhost:3001/orders/o1',
    });
    expect(r.providerRef).toBe('mock_pay_1');
    expect(r.authorizationUrl).toContain('paymentId=pay_1');
    expect(r.authorizationUrl).toContain('provider=mock');
  });

  it('accepts a correctly-signed webhook', () => {
    const body = Buffer.from(JSON.stringify({ providerRef: 'mock_pay_1', status: 'SUCCESS' }));
    const sig = p.sign(body);
    expect(p.verifyWebhook(body, sig)).toEqual({ providerRef: 'mock_pay_1', status: 'SUCCESS' });
  });

  it('rejects a tampered body', () => {
    const body = Buffer.from(JSON.stringify({ providerRef: 'mock_pay_1', status: 'SUCCESS' }));
    const sig = p.sign(body);
    const tampered = Buffer.from(JSON.stringify({ providerRef: 'mock_pay_999', status: 'SUCCESS' }));
    expect(() => p.verifyWebhook(tampered, sig)).toThrow(ForbiddenException);
  });

  it('rejects a missing signature', () => {
    const body = Buffer.from('{}');
    expect(() => p.verifyWebhook(body, undefined)).toThrow(ForbiddenException);
  });

  it('maps an explicit FAILED status', () => {
    const body = Buffer.from(JSON.stringify({ providerRef: 'mock_x', status: 'FAILED' }));
    expect(p.verifyWebhook(body, p.sign(body)).status).toBe('FAILED');
  });
});

describe('PaystackPaymentProvider webhook (HMAC-SHA512)', () => {
  const secret = 'sk_test_123';
  const p = new PaystackPaymentProvider(secret);
  const sign = (raw: Buffer) => createHmac('sha512', secret).update(raw).digest('hex');

  it('accepts charge.success with a valid signature', () => {
    const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'pay_1' } }));
    expect(p.verifyWebhook(body, sign(body))).toEqual({ providerRef: 'pay_1', status: 'SUCCESS' });
  });

  it('marks non-success events FAILED', () => {
    const body = Buffer.from(JSON.stringify({ event: 'charge.failed', data: { reference: 'pay_2' } }));
    expect(p.verifyWebhook(body, sign(body)).status).toBe('FAILED');
  });

  it('rejects an invalid signature', () => {
    const body = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: 'pay_1' } }));
    expect(() => p.verifyWebhook(body, 'deadbeef')).toThrow(ForbiddenException);
  });
});
