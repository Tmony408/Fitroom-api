import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomOrder, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FitService } from '../fit/fit.service';
import { SizeChart } from '../fit/fit.types';
import { NotificationsService } from '../notifications/notifications.service';
import { Actor, OrderStateMachine, OrderStatus } from './order-state-machine';
import { CreateOrderDto, SendQuoteDto } from './dto/order.dto';

type Measurements = Record<string, { val: number; conf: number }>;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fit: FitService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---- helpers ---------------------------------------------------------

  private async designerIdForUser(userId: string): Promise<string | null> {
    const d = await this.prisma.designer.findUnique({
      where: { userId },
      select: { id: true },
    });
    return d?.id ?? null;
  }

  private async loadOrder(id: string): Promise<CustomOrder> {
    const order = await this.prisma.customOrder.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /** Determines how the user relates to this order; throws if unrelated. */
  private async actorFor(
    order: CustomOrder,
    user: { id: string; role: string },
  ): Promise<Actor> {
    if (user.role === 'ADMIN') return 'SYSTEM';
    if (order.customerId === user.id) return 'CUSTOMER';
    const designerId = await this.designerIdForUser(user.id);
    if (designerId && order.designerId === designerId) return 'DESIGNER';
    throw new ForbiddenException('You are not a participant in this order');
  }

  private async transition(
    order: CustomOrder,
    to: OrderStatus,
    actor: Actor,
    note?: string,
  ) {
    if (!OrderStateMachine.can(order.status as OrderStatus, to, actor)) {
      throw new BadRequestException(
        `Illegal transition ${order.status} -> ${to} by ${actor}`,
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.customOrder.update({
        where: { id: order.id },
        data: { status: to },
      });
      await tx.orderEvent.create({ data: { orderId: order.id, stage: to, note } });
      return updated;
    });
  }

  // ---- commands --------------------------------------------------------

  async create(customerId: string, dto: CreateOrderDto) {
    const designer = await this.prisma.designer.findUnique({
      where: { id: dto.designerId },
    });
    if (!designer) throw new NotFoundException('Designer not found');
    if (designer.verificationStatus === 'SUSPENDED') {
      throw new BadRequestException('This designer is not currently accepting orders');
    }

    // Resolve measurements: explicit, else latest fit profile.
    let measurements: Measurements | undefined = dto.measurements;
    if (!measurements) {
      const profile = await this.prisma.fitProfile.findFirst({
        where: { userId: customerId },
        orderBy: { version: 'desc' },
      });
      if (!profile) {
        throw new BadRequestException(
          'No measurements supplied and no fit profile found. Create a fit profile first.',
        );
      }
      measurements = profile.measurements as unknown as Measurements;
    }

    // Optional size recommendation when ordering against a catalogue product.
    let recommendedSize: string | null = null;
    let fitConfidence: number | null = null;
    let basePriceKobo = 0;

    if (dto.productId) {
      const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('Product not found');
      if (product.designerId !== designer.id) {
        throw new BadRequestException('Product does not belong to that designer');
      }
      basePriceKobo = product.priceKobo;
      const chest = measurements.chest?.val;
      const waist = measurements.waist?.val;
      if (chest && waist) {
        const rec = this.fit.computeFit({
          category: product.category,
          stretch: product.stretch,
          sizeChart: product.sizeChart as unknown as SizeChart,
          chest,
          waist,
          chestConfidence: measurements.chest?.conf,
          waistConfidence: measurements.waist?.conf,
          fitPreference: dto.fitPreference,
        });
        recommendedSize = rec.recommendedSize;
        fitConfidence = rec.fitConfidence;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.customOrder.create({
        data: {
          customerId,
          designerId: designer.id,
          productId: dto.productId,
          garment: dto.garment,
          fabric: dto.fabric,
          style: dto.style as unknown as Prisma.InputJsonValue,
          addons: dto.addons ?? [],
          notes: dto.notes,
          recommendedSize,
          fitConfidence,
          measurementSnapshot: measurements as unknown as Prisma.InputJsonValue,
          basePriceKobo,
          status: 'REQUESTED',
        },
      });
      await tx.orderEvent.create({ data: { orderId: order.id, stage: 'REQUESTED' } });
      return order;
    });
  }

  async list(user: { id: string; role: string }) {
    if (user.role === 'ADMIN') {
      return this.prisma.customOrder.findMany({ orderBy: { createdAt: 'desc' } });
    }
    const designerId = await this.designerIdForUser(user.id);
    return this.prisma.customOrder.findMany({
      where: {
        OR: [{ customerId: user.id }, ...(designerId ? [{ designerId }] : [])],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(id: string, user: { id: string; role: string }) {
    const order = await this.prisma.customOrder.findUnique({
      where: { id },
      include: { quotes: true, events: { orderBy: { createdAt: 'asc' } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.actorFor(order, user); // authz
    return order;
  }

  async sendQuote(orderId: string, user: { id: string; role: string }, dto: SendQuoteDto) {
    const order = await this.loadOrder(orderId);
    const actor = await this.actorFor(order, user);
    if (actor !== 'DESIGNER') throw new ForbiddenException('Only the designer can quote');

    const updated = await this.transition(order, 'QUOTED', 'DESIGNER');
    const quote = await this.prisma.quote.create({
      data: {
        orderId,
        amountKobo: dto.amountKobo,
        leadTime: dto.leadTime,
        status: 'SENT',
      },
    });
    this.notifications.notifyOrder(orderId, 'QUOTE_SENT');
    return { order: updated, quote };
  }

  async acceptQuote(orderId: string, quoteId: string, user: { id: string; role: string }) {
    const order = await this.loadOrder(orderId);
    const actor = await this.actorFor(order, user);
    if (actor !== 'CUSTOMER') throw new ForbiddenException('Only the customer can accept');

    const quote = await this.prisma.quote.findFirst({ where: { id: quoteId, orderId } });
    if (!quote) throw new NotFoundException('Quote not found for this order');

    await this.prisma.quote.update({ where: { id: quoteId }, data: { status: 'ACCEPTED' } });
    await this.prisma.orderEvent.create({
      data: { orderId, stage: 'QUOTE_ACCEPTED', note: `Quote ${quoteId} accepted` },
    });
    this.notifications.notifyOrder(orderId, 'QUOTE_ACCEPTED');
    // Payment will move the order to PAID via the payment webhook.
    return { accepted: true, quoteId };
  }

  /**
   * STUB until Batch 4: simulates a successful payment so the production flow
   * is demoable end-to-end. Replaced by a signed payment webhook later.
   */
  async confirmPaymentStub(orderId: string) {
    const order = await this.loadOrder(orderId);
    const acceptedQuote = await this.prisma.quote.findFirst({
      where: { orderId, status: 'ACCEPTED' },
    });
    if (!acceptedQuote) {
      throw new BadRequestException('No accepted quote to pay for');
    }
    return this.transition(order, 'PAID', 'SYSTEM', 'Payment confirmed (stub)');
  }

  /**
   * Called by PaymentsService when a payment is verified. Idempotent: a repeat
   * webhook for an already-paid order is a no-op (returns the order unchanged).
   */
  async systemMarkPaid(orderId: string, note = 'Payment received') {
    const order = await this.loadOrder(orderId);
    if (order.status === 'PAID' || OrderStateMachine.isProductionStage(order.status as OrderStatus)) {
      return order; // already paid / in production — idempotent
    }
    const updated = await this.transition(order, 'PAID', 'SYSTEM', note);
    this.notifications.notifyOrder(orderId, 'PAID');
    return updated;
  }

  /** The accepted quote amount for an order, used to size a payment. */
  async acceptedQuoteAmount(orderId: string): Promise<number | null> {
    const q = await this.prisma.quote.findFirst({ where: { orderId, status: 'ACCEPTED' } });
    return q?.amountKobo ?? null;
  }

  async advanceStage(orderId: string, user: { id: string; role: string }, note?: string) {
    const order = await this.loadOrder(orderId);
    const actor = await this.actorFor(order, user);
    const next = OrderStateMachine.nextProductionStage(order.status as OrderStatus);
    if (!next) throw new BadRequestException('No further production stage');
    if (!OrderStateMachine.can(order.status as OrderStatus, next, actor)) {
      throw new ForbiddenException(`${actor} cannot advance this order`);
    }
    const updated = await this.transition(order, next, actor, note);
    this.notifications.notifyOrder(orderId, next === 'DELIVERED' ? 'DELIVERED' : 'STAGE');
    return updated;
  }

  async addNote(
    orderId: string,
    user: { id: string; role: string },
    kind: 'CLARIFICATION' | 'ALTERATION',
    note?: string,
  ) {
    const order = await this.loadOrder(orderId);
    await this.actorFor(order, user); // authz
    return this.prisma.orderEvent.create({
      data: { orderId, stage: kind, note },
    });
  }

  async cancel(orderId: string, user: { id: string; role: string }) {
    const order = await this.loadOrder(orderId);
    const actor = await this.actorFor(order, user);
    return this.transition(order, 'CANCELLED', actor, 'Cancelled');
  }

  /** Tailor-friendly measurement sheet (numbers only — no body images). */
  async measurementSheet(orderId: string, user: { id: string; role: string }) {
    const order = await this.prisma.customOrder.findUnique({
      where: { id: orderId },
      include: { customer: { select: { name: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.actorFor(order, user); // authz
    const m = order.measurementSnapshot as unknown as Measurements;
    return {
      orderId: order.id,
      customer: order.customer.name,
      garment: order.garment,
      fabric: order.fabric,
      recommendedSize: order.recommendedSize,
      measurements: Object.fromEntries(
        Object.entries(m ?? {}).map(([field, v]) => [field, `${v.val} cm`]),
      ),
    };
  }
}
