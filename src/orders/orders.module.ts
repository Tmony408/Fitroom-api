import { Module } from '@nestjs/common';
import { FitModule } from '../fit/fit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

@Module({
  imports: [FitModule, NotificationsModule], // fit engine + order emails
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
