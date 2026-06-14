import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

class UpdateSiteSettingsDto {
  @IsOptional() @IsString() heroUrl?: string;
  @IsOptional() @IsString() authUrl?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) gallery?: string[];
}

@Controller('site-settings')
export class SiteSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  // Public: the landing + auth pages read this (falls back to code defaults).
  @Get()
  get() {
    return this.prisma.siteSettings.findUnique({ where: { id: 'default' } });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch()
  update(@Body() dto: UpdateSiteSettingsDto) {
    return this.prisma.siteSettings.upsert({
      where: { id: 'default' },
      update: { ...dto },
      create: { id: 'default', ...dto },
    });
  }
}
