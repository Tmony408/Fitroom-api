import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider.interface';

@Injectable()
export class PaymentsService {
  /** Marketplace commission in basis points (e.g. 800 = 8%). */
  private readonly commissionBps = Number(process.env.COMMISSION_BPS ?? 800);
  private readonly appUrl = process.env.APP_URL ?? 'http://localhost:3001';

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly config: ConfigService,
  ) {}

  /** Customer starts paying for an order with an accepted quote. */
  async initialize(userId: string, orderId: string) {
    const order = await this.prisma.customOrder.findUnique({
      where: { id: orderId },
      include: { customer: { select: { id: true, email: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.customerId !== userId) throw new ForbiddenException('Not your order');
    if (order.status !== 'QUOTED') throw new BadRequestException('Order is not awaiting payment');

    const amountKobo = await this.orders.acceptedQuoteAmount(orderId);
    if (!amountKobo) throw new BadRequestException('Accept a quote before paying');

    // Reuse an in-flight payment if one already exists.
    const existing = await this.prisma.payment.findFirst({
      where: { orderId, status: 'PENDING' },
    });
    const payment = existing ?? (await this.prisma.payment.create({
      data: { orderId, amountKobo, currency: 'NGN', provider: this.provider.name, status: 'PENDING' },
    }));

    const init = await this.provider.initialize({
      paymentId: payment.id,
      amountKobo,
      currency: payment.currency,
      email: order.customer.email,
      callbackUrl: `${this.appUrl}/orders/${orderId}`,
    });

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: init.providerRef, authorizationUrl: init.authorizationUrl },
    });

    return {
      paymentId: updated.id,
      provider: this.provider.name,
      authorizationUrl: updated.authorizationUrl,
      amountKobo,
    };
  }

  /** Verified webhook → mark payment SUCCESS and advance the order. Idempotent. */
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    const result = this.provider.verifyWebhook(rawBody, signature);
    const payment = await this.prisma.payment.findUnique({
      where: { providerRef: result.providerRef },
    });
    if (!payment) throw new NotFoundException('Unknown payment reference');

    if (payment.status === 'SUCCESS') return { ok: true, alreadyProcessed: true };

    if (result.status === 'FAILED') {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      return { ok: true, status: 'FAILED' };
    }

    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'SUCCESS' } });
    await this.orders.systemMarkPaid(payment.orderId);
    return { ok: true, status: 'SUCCESS' };
  }

  /**
   * Dev-only helper: simulate a successful charge for the mock provider so the
   * flow is demoable without a public webhook URL. Refuses on real providers.
   */
  async completeMock(userId: string, paymentId: string) {
    if (this.provider.name !== 'mock') {
      throw new ForbiddenException('Mock completion is only available with the mock provider');
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { select: { customerId: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.order.customerId !== userId) throw new ForbiddenException('Not your payment');

    await this.prisma.payment.update({ where: { id: paymentId }, data: { status: 'SUCCESS' } });
    return this.orders.systemMarkPaid(payment.orderId, 'Payment received (mock)');
  }

  async getPayment(userId: string, id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id }, include: { order: { select: { customerId: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.order.customerId !== userId) throw new ForbiddenException('Not your payment');
    return payment;
  }

  /** Designer payouts: paid orders, net of marketplace commission. */
  async payouts(userId: string) {
    const designer = await this.prisma.designer.findUnique({
      where: { userId }, select: { id: true },
    });
    if (!designer) throw new ForbiddenException('You do not have a designer profile');

    const paid = await this.prisma.payment.findMany({
      where: { status: 'SUCCESS', order: { designerId: designer.id } },
      include: { order: { select: { id: true, garment: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const items = paid.map((p) => {
      const commissionKobo = Math.round((p.amountKobo * this.commissionBps) / 10_000);
      return {
        paymentId: p.id,
        orderId: p.orderId,
        garment: p.order.garment,
        grossKobo: p.amountKobo,
        commissionKobo,
        netKobo: p.amountKobo - commissionKobo,
        paidAt: p.updatedAt,
      };
    });

    return {
      commissionBps: this.commissionBps,
      grossKobo: items.reduce((s, i) => s + i.grossKobo, 0),
      netKobo: items.reduce((s, i) => s + i.netKobo, 0),
      items,
    };
  }
}
