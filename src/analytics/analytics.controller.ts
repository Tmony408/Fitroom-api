import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Roles('ADMIN')
  @Get('platform')
  platform() {
    return this.analytics.platform();
  }

  @Roles('DESIGNER')
  @Get('designer')
  designer(@CurrentUser() user: AuthUser) {
    return this.analytics.designer(user.id);
  }
}
