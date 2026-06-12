import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { GarmentStretch } from '@prisma/client';
import { FitPreference } from '../fit.types';

class SizeChartDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sizes: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  chest: number[];

  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  waist: number[];
}

/**
 * Either provide `productId` (engine loads the chart/category/stretch from DB)
 * or supply `category`, `stretch`, and `sizeChart` inline.
 */
export class FitCheckDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(GarmentStretch)
  stretch?: GarmentStretch;

  @IsOptional()
  @ValidateNested()
  @Type(() => SizeChartDto)
  sizeChart?: SizeChartDto;

  @IsNumber()
  @Min(1)
  chest: number;

  @IsNumber()
  @Min(1)
  waist: number;

  @IsOptional()
  @IsNumber()
  chestConfidence?: number;

  @IsOptional()
  @IsNumber()
  waistConfidence?: number;

  @IsIn(['tight', 'regular', 'relaxed', 'oversized'])
  fitPreference: FitPreference;
}
