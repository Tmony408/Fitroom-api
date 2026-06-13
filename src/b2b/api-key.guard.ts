import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeysService } from './api-keys.service';

/**
 * Authenticates B2B requests by `x-api-key`. For publishable (pk_) keys the
 * request Origin/Referer host must match the partner's domain allowlist.
 * Attaches the partner to req.partner and records lastUsedAt.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly keys: ApiKeysService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const raw = (req.headers['x-api-key'] as string | undefined)?.trim();
    if (!raw) throw new UnauthorizedException('Missing API key');

    const record = await this.prisma.apiKey.findUnique({
      where: { keyHash: this.keys.hash(raw) },
      include: { partner: true },
    });
    if (!record || record.revokedAt) throw new UnauthorizedException('Invalid API key');
    if (record.partner.status !== 'ACTIVE') throw new ForbiddenException('Partner suspended');

    // Publishable keys are exposed in the browser → enforce the domain allowlist.
    if (record.type === 'PUBLISHABLE') {
      const origin = (req.headers.origin as string) || (req.headers.referer as string) || '';
      const host = this.hostOf(origin);
      if (!host || !this.allowed(host, record.partner.domain)) {
        throw new ForbiddenException('Origin not allowed for this key');
      }
    }

    await this.prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    req.partner = record.partner;
    req.apiKeyType = record.type;
    return true;
  }

  private hostOf(url: string): string | null {
    try { return new URL(url).host.toLowerCase(); } catch { return null; }
  }

  private allowed(host: string, domain: string): boolean {
    const d = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return host === d || host.endsWith(`.${d}`) || host.startsWith('localhost');
  }
}
