import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { FitProfilesModule } from './fit-profiles/fit-profiles.module';
import { FitModule } from './fit/fit.module';
import { DesignersModule } from './designers/designers.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { StorageModule } from './storage/storage.module';
import { ScanModule } from './scan/scan.module';
import { PaymentsModule } from './payments/payments.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { B2bModule } from './b2b/b2b.module';
import { AdminModule } from './admin/admin.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    // Global rate limit: 120 requests / minute / IP (tune per route later).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    EmailModule,
    AuthModule,
    UsersModule,
    FitProfilesModule,
    FitModule,
    DesignersModule,
    ProductsModule,
    OrdersModule,
    StorageModule,
    ScanModule,
    PaymentsModule,
    AnalyticsModule,
    B2bModule,
    AdminModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
