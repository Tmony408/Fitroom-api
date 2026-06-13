import {
  ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { B2BPartner } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FitService } from '../fit/fit.service';
import { SizeChart } from '../fit/fit.types';
import { ApiKeysService } from './api-keys.service';
import { signWebhook } from './webhook-signer';
import { CreatePartnerDto, UpdatePartnerDto, CreateApiKeyDto, B2BFitCheckDto } from './dto/b2b.dto';

@Injectable()
export class B2bService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fit: FitService,
    private readonly keys: ApiKeysService,
  ) {}

  async createPartner(userId: string, dto: CreatePartnerDto) {
    const existing = await this.prisma.b2BPartner.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('You already have a partner account');
    return this.prisma.b2BPartner.create({
      data: {
        userId, company: dto.company, domain: dto.domain, webhookUrl: dto.webhookUrl,
        webhookSecret: `whsec_${randomBytes(24).toString('hex')}`,
      },
    });
  }

  async getMine(userId: string) {
    const p = await this.prisma.b2BPartner.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException('No partner account');
    return p;
  }

  async updateMine(userId: string, dto: UpdatePartnerDto) {
    await this.getMine(userId);
    return this.prisma.b2BPartner.update({ where: { userId }, data: dto });
  }

  async createKey(userId: string, dto: CreateApiKeyDto) {
    const partner = await this.getMine(userId);
    const gen = this.keys.generate(dto.type);
    await this.prisma.apiKey.create({
      data: { partnerId: partner.id, type: dto.type, prefix: gen.prefix, keyHash: gen.hash },
    });
    // raw key returned exactly once
    return { type: dto.type, key: gen.raw, prefix: gen.prefix };
  }

  async listKeys(userId: string) {
    const partner = await this.getMine(userId);
    return this.prisma.apiKey.findMany({
      where: { partnerId: partner.id },
      select: { id: true, type: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeKey(userId: string, keyId: string) {
    const partner = await this.getMine(userId);
    const key = await this.prisma.apiKey.findFirst({ where: { id: keyId, partnerId: partner.id } });
    if (!key) throw new NotFoundException('Key not found');
    await this.prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
    return { revoked: true };
  }

  async usage(userId: string) {
    const partner = await this.getMine(userId);
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [total, last30, recent] = await Promise.all([
      this.prisma.fitEvent.count({ where: { partnerId: partner.id } }),
      this.prisma.fitEvent.count({ where: { partnerId: partner.id, createdAt: { gte: since } } }),
      this.prisma.fitEvent.findMany({
        where: { partnerId: partner.id }, orderBy: { createdAt: 'desc' }, take: 10,
        select: { type: true, productRef: true, sizeRecommended: true, fitConfidence: true, createdAt: true },
      }),
    ]);
    return { totalEvents: total, last30Days: last30, recent };
  }

  /** Public widget/API call: run the fit engine, record usage, fire a webhook. */
  async fitCheck(partner: B2BPartner, dto: B2BFitCheckDto) {
    const result = this.fit.computeFit({
      category: dto.category, stretch: dto.stretch,
      sizeChart: dto.sizeChart as unknown as SizeChart,
      chest: dto.chest, waist: dto.waist,
      chestConfidence: dto.chestConfidence, waistConfidence: dto.waistConfidence,
      fitPreference: dto.fitPreference,
    });

    await this.prisma.fitEvent.create({
      data: {
        partnerId: partner.id, type: 'FIT_CHECK', productRef: dto.productRef,
        sizeRecommended: result.recommendedSize, fitConfidence: result.fitConfidence,
        metadata: { category: dto.category, fitPreference: dto.fitPreference },
      },
    });

    // Fire-and-forget signed webhook (don't block the response on partner uptime).
    if (partner.webhookUrl) {
      void this.fireWebhook(partner, { type: 'FIT_CHECK', productRef: dto.productRef, ...result });
    }
    return result;
  }

  private async fireWebhook(partner: B2BPartner, payload: unknown) {
    try {
      const body = JSON.stringify(payload);
      const signature = signWebhook(partner.webhookSecret, body);
      await fetch(partner.webhookUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-fitroom-signature': signature },
        body,
      });
    } catch {
      /* swallow — webhook delivery retries are a future enhancement */
    }
  }
}
