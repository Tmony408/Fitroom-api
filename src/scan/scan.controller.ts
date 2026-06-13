import {
  Body, Controller, Delete, Get, Param, Post, Query, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ScanService } from './scan.service';
import { CreateScanDto, UploadAssetsDto, GenerateDto } from './dto/scan.dto';

@UseGuards(JwtAuthGuard)
@Controller('scan-sessions')
export class ScanController {
  constructor(private readonly scan: ScanService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateScanDto) {
    return this.scan.create(user.id, dto);
  }

  @Post(':id/assets')
  upload(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UploadAssetsDto) {
    return this.scan.uploadAssets(user.id, id, dto);
  }

  @Post(':id/generate')
  generate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: GenerateDto) {
    return this.scan.generate(user.id, id, dto);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.scan.getOne(user.id, id);
  }

  @Get(':id/assets/:which')
  async asset(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('which') which: 'front' | 'side',
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const { data, mime } = await this.scan.streamAsset(user.id, id, which, token);
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(data);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.scan.remove(user.id, id);
  }

  // Retention: admin/cron-triggered purge of expired scans + their images.
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post('purge-expired')
  purge() {
    return this.scan.purgeExpired();
  }
}
