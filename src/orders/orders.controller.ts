import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto, SendQuoteDto, StageNoteDto } from './dto/order.dto';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.orders.list(user);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.getOne(id, user);
  }

  @Post(':id/quotes')
  sendQuote(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: SendQuoteDto) {
    return this.orders.sendQuote(id, user, dto);
  }

  @Post(':id/quotes/:quoteId/accept')
  acceptQuote(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.orders.acceptQuote(id, quoteId, user);
  }

  // STUB until Batch 4 (payments). Simulates payment so production can proceed.
  @Post(':id/confirm-payment')
  confirmPayment(@Param('id') id: string) {
    return this.orders.confirmPaymentStub(id);
  }

  @Post(':id/advance')
  advance(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StageNoteDto) {
    return this.orders.advanceStage(id, user, dto.note);
  }

  @Post(':id/clarification')
  clarify(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StageNoteDto) {
    return this.orders.addNote(id, user, 'CLARIFICATION', dto.note);
  }

  @Post(':id/alteration')
  alteration(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StageNoteDto) {
    return this.orders.addNote(id, user, 'ALTERATION', dto.note);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.cancel(id, user);
  }

  @Get(':id/measurement-sheet')
  measurementSheet(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.measurementSheet(id, user);
  }
}
