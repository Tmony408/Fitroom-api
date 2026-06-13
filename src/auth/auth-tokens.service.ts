import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Opaque token helper for refresh + verification tokens.
 * We hand the raw token to the client once and only ever store its SHA-256
 * hash, so a database leak never exposes usable tokens. Pure & testable.
 */
@Injectable()
export class AuthTokensService {
  /** A 256-bit URL-safe random token. */
  generate(): string {
    return randomBytes(32).toString('hex');
  }

  hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Constant-time comparison of a raw token against a stored hash. */
  matches(token: string, storedHash: string): boolean {
    const a = Buffer.from(this.hash(token));
    const b = Buffer.from(storedHash);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
