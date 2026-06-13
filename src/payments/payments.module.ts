import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersModule } from '../orders/orders.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks.controller';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider.interface';
import { MockPaymentProvider } from './mock-payment.provider';
import { PaystackPaymentProvider } from './paystack-payment.provider';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): PaymentProvider => {
        const driver = config.get<string>('PAYMENT_PROVIDER') ?? 'mock';
        switch (driver) {
          case 'mock':
            // mock webhooks are signed with JWT_SECRET (dev only)
            return new MockPaymentProvider(config.getOrThrow<string>('JWT_SECRET'));
          case 'paystack':
            return new PaystackPaymentProvider(config.getOrThrow<string>('PAYSTACK_SECRET_KEY'));
          default:
            throw new Error(`Unsupported PAYMENT_PROVIDER: ${driver}`);
        }
      },
    },
  ],
})
export class PaymentsModule {}
