import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateScanDto {
  @IsOptional()
  @IsInt()
  @Min(120)
  @Max(230)
  declaredHeightCm?: number;
}

export class UploadAssetsDto {
  // base64 (data URL or raw) for each pose. At least one required.
  @IsOptional()
  @IsString()
  front?: string;

  @IsOptional()
  @IsString()
  side?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  qualityScore?: number;
}

export class GenerateDto {
  // Optional override / supply if not set at creation.
  @IsOptional()
  @IsInt()
  @Min(120)
  @Max(230)
  declaredHeightCm?: number;
}
