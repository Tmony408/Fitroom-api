import { BadRequestException, Body, Controller, NotFoundException, Post } from '@nestjs/common';
import { GarmentStretch } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FitService } from './fit.service';
import { FitCheckDto } from './dto/fit-check.dto';
import { FitCheckResult, SizeChart } from './fit.types';

@Controller('garments')
export class FitController {
  constructor(
    private readonly fit: FitService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('fit-check')
  async fitCheck(@Body() dto: FitCheckDto): Promise<FitCheckResult> {
    let category = dto.category;
    let stretch: GarmentStretch | undefined = dto.stretch;
    let sizeChart = dto.sizeChart as SizeChart | undefined;

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Product not found');
      category = product.category;
      stretch = product.stretch;
      sizeChart = product.sizeChart as unknown as SizeChart;
    }

    if (!category || !stretch || !sizeChart) {
      throw new BadRequestException(
        'Provide productId, or category + stretch + sizeChart inline',
      );
    }

    return this.fit.computeFit({
      category,
      stretch,
      sizeChart,
      chest: dto.chest,
      waist: dto.waist,
      chestConfidence: dto.chestConfidence,
      waistConfidence: dto.waistConfidence,
      fitPreference: dto.fitPreference,
    });
  }
}
