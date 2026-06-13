import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { PaymentsService } from './payments.service';

class InitPaymentDto {
  @IsString()
  orderId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('initialize')
  initialize(@CurrentUser() user: AuthUser, @Body() dto: InitPaymentDto) {
    return this.payments.initialize(user.id, dto.orderId);
  }

  // Dev-only: simulate a successful charge for the mock provider.
  @Post(':id/complete-mock')
  completeMock(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.completeMock(user.id, id);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.getPayment(user.id, id);
  }

  @UseGuards(RolesGuard)
  @Roles('DESIGNER')
  @Get('me/payouts')
  payouts(@CurrentUser() user: AuthUser) {
    return this.payments.payouts(user.id);
  }
}
