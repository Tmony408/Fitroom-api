import { ApiKeysService } from './api-keys.service';
import { signWebhook, verifyWebhook } from './webhook-signer';

describe('ApiKeysService', () => {
  const svc = new ApiKeysService();

  it('generates a pk_ key for publishable', () => {
    const k = svc.generate('PUBLISHABLE');
    expect(k.raw).toMatch(/^pk_test_[0-9a-f]{48}$/);
    expect(svc.isPublishable(k.raw)).toBe(true);
    expect(k.prefix.length).toBe(16);
  });

  it('generates an sk_ live key for secret', () => {
    const k = svc.generate('SECRET', true);
    expect(k.raw).toMatch(/^sk_live_/);
    expect(svc.isPublishable(k.raw)).toBe(false);
  });

  it('stores only the hash and verifies it', () => {
    const k = svc.generate('SECRET');
    expect(k.hash).not.toContain(k.raw);
    expect(svc.matches(k.raw, k.hash)).toBe(true);
    expect(svc.matches(svc.generate('SECRET').raw, k.hash)).toBe(false);
  });

  it('does not throw on a malformed stored hash', () => {
    expect(svc.matches(svc.generate('SECRET').raw, 'nope')).toBe(false);
  });
});

describe('webhook signer', () => {
  const secret = 'whsec_123';
  const body = JSON.stringify({ type: 'FIT_CHECK', size: 'L' });

  it('accepts a freshly-signed payload', () => {
    const header = signWebhook(secret, body);
    expect(verifyWebhook(secret, body, header)).toBe(true);
  });

  it('rejects a wrong secret', () => {
    const header = signWebhook(secret, body);
    expect(verifyWebhook('whsec_other', body, header)).toBe(false);
  });

  it('rejects a tampered body', () => {
    const header = signWebhook(secret, body);
    expect(verifyWebhook(secret, body + 'x', header)).toBe(false);
  });

  it('rejects a stale timestamp', () => {
    const old = signWebhook(secret, body, Date.now() - 10 * 60_000);
    expect(verifyWebhook(secret, body, old)).toBe(false);
  });
});
