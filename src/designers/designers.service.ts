import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDesignerDto, UpdateDesignerDto } from './dto/designer.dto';

@Injectable()
export class DesignersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the caller's designer profile and promotes them to DESIGNER. */
  async create(userId: string, dto: CreateDesignerDto) {
    const existing = await this.prisma.designer.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Designer profile already exists');

    const [, designer] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { role: 'DESIGNER' } }),
      this.prisma.designer.create({
        data: {
          userId,
          brand: dto.brand,
          location: dto.location,
          leadTime: dto.leadTime ?? '10-14 days',
          specialties: dto.specialties ?? [],
        },
      }),
    ]);
    return designer;
  }

  async getById(id: string) {
    const designer = await this.prisma.designer.findUnique({
      where: { id },
      include: { products: true },
    });
    if (!designer) throw new NotFoundException('Designer not found');
    return designer;
  }

  async getByUserId(userId: string) {
    const designer = await this.prisma.designer.findUnique({ where: { userId } });
    if (!designer) throw new NotFoundException('No designer profile for this user');
    return designer;
  }

  async updateMe(userId: string, dto: UpdateDesignerDto) {
    await this.getByUserId(userId);
    return this.prisma.designer.update({ where: { userId }, data: dto });
  }

  /** KPI snapshot for the designer dashboard. */
  async dashboard(userId: string) {
    const designer = await this.getByUserId(userId);
    const [openRequests, activeOrders, paidOrders, productCount] = await Promise.all([
      this.prisma.customOrder.count({ where: { designerId: designer.id, status: 'REQUESTED' } }),
      this.prisma.customOrder.count({
        where: {
          designerId: designer.id,
          status: { in: ['PAID', 'CUTTING', 'SEWING', 'QUALITY_CHECK', 'SHIPPED'] },
        },
      }),
      this.prisma.customOrder.findMany({
        where: {
          designerId: designer.id,
          status: { in: ['PAID', 'CUTTING', 'SEWING', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED'] },
        },
        include: { quotes: { where: { status: 'ACCEPTED' }, take: 1 } },
      }),
      this.prisma.product.count({ where: { designerId: designer.id } }),
    ]);

    const paidRevenueKobo = paidOrders.reduce(
      (sum, o) => sum + (o.quotes[0]?.amountKobo ?? 0),
      0,
    );

    return {
      designerId: designer.id,
      brand: designer.brand,
      openRequests,
      activeOrders,
      paidOrders: paidOrders.length,
      paidRevenueKobo,
      productCount,
    };
  }
}
