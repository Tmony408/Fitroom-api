import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFitProfileDto } from './dto/create-fit-profile.dto';

@Injectable()
export class FitProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates a new versioned fit profile. Requires body-data consent. */
  async create(userId: string, dto: CreateFitProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { consentBodyData: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.consentBodyData) {
      throw new ForbiddenException('Body-data consent is required before saving measurements');
    }

    const last = await this.prisma.fitProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    return this.prisma.fitProfile.create({
      data: {
        userId,
        label: dto.label?.trim() || 'My measurements',
        version,
        fitPref: dto.fitPref ?? 'regular',
        measurements: dto.measurements as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async findOne(userId: string, id: string) {
    const profile = await this.prisma.fitProfile.findFirst({ where: { id, userId } });
    if (!profile) throw new NotFoundException('Fit profile not found');
    return profile;
  }

  async deleteOne(userId: string, id: string) {
    const { count } = await this.prisma.fitProfile.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Fit profile not found');
    return { deleted: count };
  }

  list(userId: string) {
    return this.prisma.fitProfile.findMany({
      where: { userId },
      orderBy: { version: 'desc' },
    });
  }

  async getLatest(userId: string) {
    const profile = await this.prisma.fitProfile.findFirst({
      where: { userId },
      orderBy: { version: 'desc' },
    });
    if (!profile) throw new NotFoundException('No fit profile yet');
    return profile;
  }

  /** Privacy: hard-delete all of a user's fit profiles (right to erasure). */
  async deleteAll(userId: string) {
    const { count } = await this.prisma.fitProfile.deleteMany({ where: { userId } });
    return { deleted: count };
  }
}
