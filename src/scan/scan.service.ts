import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ScanSession } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE, StorageService } from '../storage/storage.interface';
import { SignedUrlService } from '../storage/signed-url.service';
import { MeasurementEstimatorService } from './measurement-estimator.service';
import { CreateScanDto, UploadAssetsDto, GenerateDto } from './dto/scan.dto';

const MAX_BYTES = 6 * 1024 * 1024; // 6MB per image

interface AssetRef { key: string; mime: string }
type Assets = { front?: AssetRef; side?: AssetRef };

@Injectable()
export class ScanService {
  private readonly retentionDays = Number(process.env.SCAN_RETENTION_DAYS ?? 7);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: StorageService,
    private readonly signer: SignedUrlService,
    private readonly estimator: MeasurementEstimatorService,
  ) {}

  private async requireConsent(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { consentBodyData: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.consentBodyData) {
      throw new ForbiddenException('Body-data consent is required before a scan');
    }
  }

  private async owned(userId: string, id: string): Promise<ScanSession> {
    const s = await this.prisma.scanSession.findFirst({ where: { id, userId } });
    if (!s) throw new NotFoundException('Scan session not found');
    return s;
  }

  async create(userId: string, dto: CreateScanDto) {
    await this.requireConsent(userId);
    const expiresAt = new Date(Date.now() + this.retentionDays * 86_400_000);
    return this.prisma.scanSession.create({
      data: { userId, declaredHeightCm: dto.declaredHeightCm, status: 'PENDING', expiresAt },
    });
  }

  private decode(input: string): { buf: Buffer; mime: string } {
    const m = /^data:(.+?);base64,(.*)$/.exec(input);
    const mime = m ? m[1] : 'image/jpeg';
    const b64 = m ? m[2] : input;
    const buf = Buffer.from(b64, 'base64');
    if (buf.length === 0) throw new BadRequestException('Empty image');
    if (buf.length > MAX_BYTES) throw new BadRequestException('Image exceeds 6MB');
    return { buf, mime };
  }

  async uploadAssets(userId: string, id: string, dto: UploadAssetsDto) {
    const session = await this.owned(userId, id);
    if (!dto.front && !dto.side) throw new BadRequestException('Provide at least one of front/side');

    const assets: Assets = (session.assets as unknown as Assets) ?? {};
    for (const which of ['front', 'side'] as const) {
      const raw = dto[which];
      if (!raw) continue;
      const { buf, mime } = this.decode(raw);
      const key = `scan/${id}/${which}`;
      await this.storage.put(key, buf, mime);
      assets[which] = { key, mime };
    }
    return this.prisma.scanSession.update({
      where: { id },
      data: {
        assets: assets as unknown as Prisma.InputJsonValue,
        qualityResults: dto.qualityScore != null ? { qualityScore: dto.qualityScore } : undefined,
        status: 'UPLOADED',
      },
    });
  }

  async generate(userId: string, id: string, dto: GenerateDto) {
    const session = await this.owned(userId, id);
    const height = dto.declaredHeightCm ?? session.declaredHeightCm ?? undefined;
    if (!height) throw new BadRequestException('declaredHeightCm is required to estimate measurements');

    const assets = (session.assets as unknown as Assets) ?? {};
    const quality = (session.qualityResults as { qualityScore?: number } | null)?.qualityScore;

    try {
      const { measurements, modelVersion } = this.estimator.estimate({
        declaredHeightCm: height,
        hasFront: !!assets.front,
        hasSide: !!assets.side,
        qualityScore: quality,
      });
      return this.prisma.scanSession.update({
        where: { id },
        data: {
          declaredHeightCm: height,
          measurements: measurements as unknown as Prisma.InputJsonValue,
          modelVersion,
          status: 'PROCESSED',
        },
      });
    } catch (e) {
      await this.prisma.scanSession.update({ where: { id }, data: { status: 'FAILED' } });
      throw e;
    }
  }

  /** Returns the session with short-lived signed URLs for any stored assets. */
  async getOne(userId: string, id: string) {
    const s = await this.owned(userId, id);
    const assets = (s.assets as unknown as Assets) ?? {};
    const assetUrls: Record<string, string> = {};
    for (const which of ['front', 'side'] as const) {
      if (assets[which]) {
        const { token } = this.signer.sign(assets[which]!.key);
        assetUrls[which] = `/api/scan-sessions/${id}/assets/${which}?token=${token}`;
      }
    }
    return {
      id: s.id, status: s.status, declaredHeightCm: s.declaredHeightCm,
      modelVersion: s.modelVersion, measurements: s.measurements,
      expiresAt: s.expiresAt, assetUrls,
    };
  }

  async streamAsset(userId: string, id: string, which: 'front' | 'side', token: string) {
    const s = await this.owned(userId, id);
    const assets = (s.assets as unknown as Assets) ?? {};
    const ref = assets[which];
    if (!ref) throw new NotFoundException('Asset not found');
    this.signer.verify(ref.key, token); // short-lived signature check
    return this.storage.get(ref.key);
  }

  /** Privacy: delete the session and purge its stored images. */
  async remove(userId: string, id: string) {
    await this.owned(userId, id);
    await this.storage.removePrefix(`scan/${id}`);
    await this.prisma.scanSession.delete({ where: { id } });
    return { deleted: true };
  }

  /** Retention: purge sessions past expiry and their images. Call from a cron. */
  async purgeExpired() {
    const expired = await this.prisma.scanSession.findMany({
      where: { expiresAt: { lt: new Date() } }, select: { id: true },
    });
    for (const { id } of expired) {
      await this.storage.removePrefix(`scan/${id}`);
    }
    const { count } = await this.prisma.scanSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return { purged: count };
  }
}
