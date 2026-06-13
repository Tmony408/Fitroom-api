import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ratePct, topCounts, sum } from './analytics.util';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Platform-wide funnel + commerce + fit-quality, derived from live tables. */
  async platform() {
    const [
      customers, designers,
      usersWithProfile, totalScans, processedScans,
      requested, paid, alterations,
      paidPayments,
    ] = await Promise.all([
      this.prisma.user.count({ where: { role: 'CUSTOMER' } }),
      this.prisma.designer.count(),
      this.prisma.fitProfile.findMany({ distinct: ['userId'], select: { userId: true } }),
      this.prisma.scanSession.count(),
      this.prisma.scanSession.count({ where: { status: 'PROCESSED' } }),
      this.prisma.customOrder.count(),
      this.prisma.customOrder.count({
        where: { status: { in: ['PAID', 'CUTTING', 'SEWING', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED'] } },
      }),
      this.prisma.orderEvent.count({ where: { stage: 'ALTERATION' } }),
      this.prisma.payment.findMany({ where: { status: 'SUCCESS' }, select: { amountKobo: true } }),
    ]);

    const gmvKobo = sum(paidPayments.map((p) => p.amountKobo));

    return {
      acquisition: { customers, designers },
      activation: {
        usersWithProfile: usersWithProfile.length,
        profileRatePct: ratePct(usersWithProfile.length, customers),
        scansTotal: totalScans,
        scanCompletionPct: ratePct(processedScans, totalScans),
      },
      commerce: {
        ordersRequested: requested,
        ordersPaid: paid,
        conversionPct: ratePct(paid, requested),
        gmvKobo,
        avgOrderValueKobo: paid ? Math.round(gmvKobo / paid) : 0,
      },
      fitQuality: {
        alterationRequests: alterations,
        alterationRatePct: ratePct(alterations, paid),
      },
    };
  }

  /** Per-designer insights from their own orders. */
  async designer(userId: string) {
    const designer = await this.prisma.designer.findUnique({
      where: { userId }, select: { id: true, brand: true },
    });
    if (!designer) throw new ForbiddenException('You do not have a designer profile');

    const orders = await this.prisma.customOrder.findMany({
      where: { designerId: designer.id },
      select: { id: true, status: true, recommendedSize: true, garment: true },
    });

    const paidStatuses = ['PAID', 'CUTTING', 'SEWING', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED'];
    const requested = orders.length;
    const paid = orders.filter((o) => paidStatuses.includes(o.status)).length;

    const alterations = await this.prisma.orderEvent.count({
      where: { stage: 'ALTERATION', order: { designerId: designer.id } },
    });

    return {
      brand: designer.brand,
      ordersRequested: requested,
      ordersPaid: paid,
      conversionPct: ratePct(paid, requested),
      commonSizes: topCounts(orders.map((o) => o.recommendedSize)),
      commonGarments: topCounts(orders.map((o) => o.garment)),
      alterationRequests: alterations,
      alterationRatePct: ratePct(alterations, paid),
    };
  }
}
