import { Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Short-lived signed URLs for sensitive scan assets (PRD security requirement).
 * We sign "key|expiry" with HMAC-SHA256 over JWT_SECRET. The asset route
 * verifies the signature + expiry before streaming the file. With S3 this is
 * replaced by native presigned URLs — same contract.
 */
@Injectable()
export class SignedUrlService {
  private readonly secret: string;
  constructor(config: ConfigService) {
    this.secret = config.getOrThrow<string>('JWT_SECRET');
  }

  sign(key: string, ttlSeconds = 300): { token: string; expires: number } {
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = this.hmac(`${key}|${expires}`);
    return { token: `${expires}.${sig}`, expires };
  }

  verify(key: string, token: string): void {
    const [expStr, sig] = (token ?? '').split('.');
    const expires = Number(expStr);
    if (!expStr || !sig || Number.isNaN(expires)) throw new ForbiddenException('Invalid asset token');
    if (expires < Math.floor(Date.now() / 1000)) throw new ForbiddenException('Asset link expired');
    const expected = this.hmac(`${key}|${expires}`);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ForbiddenException('Bad asset signature');
  }

  private hmac(input: string): string {
    return createHmac('sha256', this.secret).update(input).digest('hex');
  }
}
