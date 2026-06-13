import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EMAIL, EmailService } from '../email/email.interface';

export type OrderNotice =
  | 'QUOTE_SENT' | 'QUOTE_ACCEPTED' | 'PAID' | 'STAGE' | 'DELIVERED';

/**
 * Order lifecycle notifications. Uses the same EMAIL seam as auth (console in
 * dev, Brevo in prod). All sends are fire-and-forget — a mail hiccup must never
 * block an order transition.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  private readonly appUrl = process.env.APP_URL ?? 'http://localhost:3001';

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMAIL) private readonly email: EmailService,
  ) {}

  /** Send the right email(s) for an order event. Never throws. */
  notifyOrder(orderId: string, kind: OrderNotice): void {
    void this.run(orderId, kind).catch((e) =>
      this.logger.warn(`notify ${kind} failed for ${orderId}: ${(e as Error).message}`),
    );
  }

  private async run(orderId: string, kind: OrderNotice) {
    const order = await this.prisma.customOrder.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { name: true, email: true } },
        designer: { select: { brand: true, user: { select: { email: true, name: true } } } },
        quotes: { where: { status: 'ACCEPTED' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!order) return;

    const link = `${this.appUrl}/orders/${order.id}`;
    const dLink = `${this.appUrl}/designer/orders/${order.id}`;
    const item = `${order.garment} (${order.fabric})`;
    const naira = (k?: number) => (k != null ? '₦' + Math.round(k / 100).toLocaleString() : '');
    const customer = order.customer;
    const designerEmail = order.designer.user.email;
    const brand = order.designer.brand;

    switch (kind) {
      case 'QUOTE_SENT':
        await this.email.send({
          to: customer.email,
          subject: `Your ${order.garment} quote from ${brand}`,
          text: `Hi ${customer.name},\n${brand} sent a quote for your ${item}.\nReview and pay to start production:\n${link}`,
        });
        break;
      case 'QUOTE_ACCEPTED':
        await this.email.send({
          to: designerEmail,
          subject: `Quote accepted — ${item}`,
          text: `${customer.name} accepted your quote for ${item}. They'll pay next.\n${dLink}`,
        });
        break;
      case 'PAID':
        await Promise.all([
          this.email.send({
            to: customer.email,
            subject: `Payment received — your ${order.garment} is in production`,
            text: `Hi ${customer.name},\nWe received your payment${order.quotes[0] ? ` of ${naira(order.quotes[0].amountKobo)}` : ''}. ${brand} is starting production.\nTrack it: ${link}`,
          }),
          this.email.send({
            to: designerEmail,
            subject: `Paid order — start production: ${item}`,
            text: `${customer.name} paid for ${item}. Begin production and advance the stages.\n${dLink}`,
          }),
        ]);
        break;
      case 'STAGE':
        await this.email.send({
          to: customer.email,
          subject: `Order update: ${order.status.replace('_', ' ').toLowerCase()}`,
          text: `Hi ${customer.name},\nYour ${item} is now "${order.status.replace('_', ' ').toLowerCase()}".\nTrack it: ${link}`,
        });
        break;
      case 'DELIVERED':
        await this.email.send({
          to: customer.email,
          subject: `Delivered — enjoy your ${order.garment}! `,
          text: `Hi ${customer.name},\nYour ${item} is marked delivered. If anything needs adjusting, request an alteration here:\n${link}`,
        });
        break;
    }
  }
}
