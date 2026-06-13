import { Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested,
} from 'class-validator';
import { ApiKeyType } from '@prisma/client';
import { FitPreference } from '../../fit/fit.types';

export class CreatePartnerDto {
  @IsString() @MinLength(2)
  company: string;

  @IsString()
  domain: string; // allowlisted host, e.g. shop.example.com

  @IsOptional() @IsString()
  webhookUrl?: string;
}

export class UpdatePartnerDto {
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() domain?: string;
  @IsOptional() @IsString() webhookUrl?: string;
}

export class CreateApiKeyDto {
  @IsEnum(ApiKeyType)
  type: ApiKeyType;
}

class SizeChartDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) sizes: string[];
  @IsArray() @ArrayNotEmpty() @IsNumber({}, { each: true }) chest: number[];
  @IsArray() @ArrayNotEmpty() @IsNumber({}, { each: true }) waist: number[];
}

// Partners send a garment definition inline (they don't have our product IDs).
export class B2BFitCheckDto {
  @IsString() category: string;
  @IsIn(['NONE', 'LOW', 'MEDIUM', 'HIGH']) stretch: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
  @ValidateNested() @Type(() => SizeChartDto) sizeChart: SizeChartDto;
  @IsNumber() @Min(1) chest: number;
  @IsNumber() @Min(1) waist: number;
  @IsIn(['tight', 'regular', 'relaxed', 'oversized']) fitPreference: FitPreference;
  @IsOptional() @IsString() productRef?: string;
  @IsOptional() @IsInt() chestConfidence?: number;
  @IsOptional() @IsInt() waistConfidence?: number;
}
