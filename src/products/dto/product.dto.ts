import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { GarmentStretch } from '@prisma/client';

class SizeChartDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  sizes: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  chest: number[];

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  waist: number[];
}

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsString()
  category: string;

  @IsString()
  fabric: string;

  @IsEnum(GarmentStretch)
  stretch: GarmentStretch;

  @IsInt()
  @Min(0)
  priceKobo: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ValidateNested()
  @Type(() => SizeChartDto)
  sizeChart: SizeChartDto;
}

export class UpdateProductDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() fabric?: string;
  @IsOptional() @IsEnum(GarmentStretch) stretch?: GarmentStretch;
  @IsOptional() @IsInt() @Min(0) priceKobo?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) images?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SizeChartDto)
  sizeChart?: SizeChartDto;
}
