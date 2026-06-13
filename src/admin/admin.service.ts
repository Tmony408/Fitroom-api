import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';

const STATUSES = ['PENDING', 'VERIFIED', 'SUSPENDED'] as const;
type DesignerStatus = (typeof STATUSES)[number];

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  async overview() {
    const platform = await this.analytics.platform();
    const [pendingDesigners, partners, openDisputes] = await Promise.all([
      this.prisma.designer.count({ where: { verificationStatus: 'PENDING' } }),
      this.prisma.b2BPartner.count(),
      this.prisma.orderEvent.count({ where: { stage: 'ALTERATION' } }),
    ]);
    return { ...platform, pendingDesigners, partners, openDisputes };
  }

  listDesigners() {
    return this.prisma.designer.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, brand: true, location: true, specialties: true,
        verificationStatus: true, createdAt: true,
        user: { select: { name: true, email: true } },
        _count: { select: { orders: true, products: true } },
      },
    });
  }

  async setDesignerStatus(id: string, status: DesignerStatus) {
    if (!STATUSES.includes(status)) throw new BadRequestException('Invalid status');
    const designer = await this.prisma.designer.findUnique({ where: { id } });
    if (!designer) throw new NotFoundException('Designer not found');
    return this.prisma.designer.update({
      where: { id },
      data: { verificationStatus: status },
      select: { id: true, brand: true, verificationStatus: true },
    });
  }

  recentOrders(limit = 50) {
    return this.prisma.customOrder.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, garment: true, fabric: true, status: true, createdAt: true,
        customer: { select: { name: true } },
        designer: { select: { brand: true } },
      },
    });
  }

  /** Fit-issue feed: recent alteration requests (the closest thing to disputes). */
  async fitIssues(limit = 30) {
    const events = await this.prisma.orderEvent.findMany({
      where: { stage: 'ALTERATION' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, note: true, createdAt: true, orderId: true,
        order: { select: { garment: true, customer: { select: { name: true } }, designer: { select: { brand: true } } } },
      },
    });
    return events.map((e) => ({
      id: e.id, orderId: e.orderId, note: e.note, createdAt: e.createdAt,
      garment: e.order.garment, customer: e.order.customer.name, brand: e.order.designer.brand,
    }));
  }
}
