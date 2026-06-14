import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private async designerIdForUser(userId: string): Promise<string> {
    const designer = await this.prisma.designer.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!designer) throw new ForbiddenException('You do not have a designer profile');
    return designer.id;
  }

  private async assertOwner(productId: string, userId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    const designerId = await this.designerIdForUser(userId);
    if (product.designerId !== designerId) {
      throw new ForbiddenException('Not your product');
    }
    return product;
  }

  async create(userId: string, dto: CreateProductDto) {
    const designerId = await this.designerIdForUser(userId);
    return this.prisma.product.create({
      data: {
        designerId,
        title: dto.title,
        category: dto.category,
        fabric: dto.fabric,
        stretch: dto.stretch,
        priceKobo: dto.priceKobo,
        images: dto.images ?? [],
        sizeChart: dto.sizeChart as unknown as Prisma.InputJsonValue,
      },
    });
  }

  list(filter?: { designerId?: string; category?: string }) {
    return this.prisma.product.findMany({
      where: {
        designerId: filter?.designerId,
        // case-insensitive so "agbada" / "Agbada" land in the same collection
        ...(filter?.category
          ? { category: { equals: filter.category, mode: 'insensitive' as const } }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      // only brand here — handle requires a migration that isn't applied in prod yet
      include: { designer: { select: { brand: true } } },
    });
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(userId: string, id: string, dto: UpdateProductDto) {
    await this.assertOwner(id, userId);
    return this.prisma.product.update({
      where: { id },
      data: {
        ...dto,
        sizeChart: dto.sizeChart
          ? (dto.sizeChart as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwner(id, userId);
    await this.prisma.product.delete({ where: { id } });
    return { deleted: true };
  }
}
