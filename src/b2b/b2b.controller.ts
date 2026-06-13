import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { B2BPartner } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { B2bService } from './b2b.service';
import { ApiKeyGuard } from './api-key.guard';
import { CreatePartnerDto, UpdatePartnerDto, CreateApiKeyDto, B2BFitCheckDto } from './dto/b2b.dto';

@Controller('b2b')
export class B2bController {
  constructor(private readonly b2b: B2bService) {}

  // ---- partner portal (JWT owner) ----
  @UseGuards(JwtAuthGuard)
  @Post('partners')
  createPartner(@CurrentUser() user: AuthUser, @Body() dto: CreatePartnerDto) {
    return this.b2b.createPartner(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('partners/me')
  getMine(@CurrentUser() user: AuthUser) {
    return this.b2b.getMine(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('partners/me')
  updateMine(@CurrentUser() user: AuthUser, @Body() dto: UpdatePartnerDto) {
    return this.b2b.updateMine(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('api-keys')
  createKey(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.b2b.createKey(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('api-keys')
  listKeys(@CurrentUser() user: AuthUser) {
    return this.b2b.listKeys(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('api-keys/:id')
  revokeKey(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.b2b.revokeKey(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('usage')
  usage(@CurrentUser() user: AuthUser) {
    return this.b2b.usage(user.id);
  }

  // ---- public API (API key) ----
  @UseGuards(ApiKeyGuard)
  @Post('fit-check')
  fitCheck(@Req() req: { partner: B2BPartner }, @Body() dto: B2BFitCheckDto) {
    return this.b2b.fitCheck(req.partner, dto);
  }
}
