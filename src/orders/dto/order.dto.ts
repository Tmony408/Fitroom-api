import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { FitPreference } from '../../fit/fit.types';

class StyleDto {
  @IsOptional() @IsString() neck?: string;
  @IsOptional() @IsString() sleeve?: string;
  @IsOptional() @IsString() length?: string;
}

export class CreateOrderDto {
  @IsString()
  designerId: string;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  garment: string;

  @IsString()
  fabric: string;

  @ValidateNested()
  @Type(() => StyleDto)
  style: StyleDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addons?: string[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsIn(['tight', 'regular', 'relaxed', 'oversized'])
  fitPreference: FitPreference;

  // Optional explicit measurement snapshot; if omitted, the customer's latest
  // fit profile is used. Shape: { field: { val, conf } }.
  @IsOptional()
  @IsObject()
  measurements?: Record<string, { val: number; conf: number }>;
}

export class SendQuoteDto {
  @IsInt()
  @Min(0)
  amountKobo: number;

  @IsOptional()
  @IsString()
  leadTime?: string;
}

export class StageNoteDto {
  @IsOptional()
  @IsString()
  note?: string;
}
