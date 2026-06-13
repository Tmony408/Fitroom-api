import { AuthTokensService } from './auth-tokens.service';

describe('AuthTokensService', () => {
  const svc = new AuthTokensService();

  it('generates distinct 64-char hex tokens', () => {
    const a = svc.generate();
    const b = svc.generate();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('hashes deterministically and never returns the raw token', () => {
    const t = svc.generate();
    expect(svc.hash(t)).toBe(svc.hash(t));
    expect(svc.hash(t)).not.toBe(t);
  });

  it('matches a token against its own hash', () => {
    const t = svc.generate();
    expect(svc.matches(t, svc.hash(t))).toBe(true);
  });

  it('rejects a wrong token', () => {
    const t = svc.generate();
    expect(svc.matches(svc.generate(), svc.hash(t))).toBe(false);
  });

  it('rejects against a malformed hash without throwing', () => {
    expect(svc.matches(svc.generate(), 'short')).toBe(false);
  });
});
