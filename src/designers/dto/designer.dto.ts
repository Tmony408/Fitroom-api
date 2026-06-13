import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDesignerDto {
  @IsString()
  @MinLength(2)
  brand: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  leadTime?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}

export class UpdateDesignerDto {
  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  leadTime?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];
}
