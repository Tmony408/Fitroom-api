import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminService } from './admin.service';

class SetStatusDto {
  @IsIn(['PENDING', 'VERIFIED', 'SUSPENDED'])
  status: 'PENDING' | 'VERIFIED' | 'SUSPENDED';
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('designers')
  designers() {
    return this.admin.listDesigners();
  }

  @Post('designers/:id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetStatusDto) {
    return this.admin.setDesignerStatus(id, dto.status);
  }

  @Get('orders')
  orders() {
    return this.admin.recentOrders();
  }

  @Get('fit-issues')
  fitIssues() {
    return this.admin.fitIssues();
  }
}
