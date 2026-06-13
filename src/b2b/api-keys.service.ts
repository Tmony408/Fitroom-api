import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { ApiKeyType } from '@prisma/client';

export interface GeneratedKey {
  raw: string;    // shown to the partner exactly once
  prefix: string; // safe to display later
  hash: string;   // stored
}

/**
 * API keys for the B2B platform. Format: `<pk|sk>_<env>_<random>`.
 * Publishable (pk) keys ride in the browser widget and are restricted by a
 * domain allowlist; secret (sk) keys are server-to-server. Only the SHA-256
 * hash is stored — the raw key is shown once.
 */
@Injectable()
export class ApiKeysService {
  generate(type: ApiKeyType, live = false): GeneratedKey {
    const kind = type === 'PUBLISHABLE' ? 'pk' : 'sk';
    const env = live ? 'live' : 'test';
    const raw = `${kind}_${env}_${randomBytes(24).toString('hex')}`;
    return { raw, prefix: raw.slice(0, 16), hash: this.hash(raw) };
  }

  hash(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  matches(raw: string, storedHash: string): boolean {
    const a = Buffer.from(this.hash(raw));
    const b = Buffer.from(storedHash);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  isPublishable(raw: string): boolean {
    return raw.startsWith('pk_');
  }
}
