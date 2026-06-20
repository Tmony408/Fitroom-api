import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TryOnService } from './tryon.service';

class TryOnDto {
  @IsString()
  personImage: string; // data URL, base64, or http(s) URL

  @IsString()
  garmentImage: string;

  @IsOptional()
  @IsString()
  category?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('tryon')
export class TryOnController {
  constructor(private readonly tryon: TryOnService) {}

  @Get('status')
  status() {
    return { provider: this.tryon.providerName };
  }

  @Post()
  @HttpCode(200)
  generate(@Body() dto: TryOnDto) {
    return this.tryon.generate(dto);
  }
}
