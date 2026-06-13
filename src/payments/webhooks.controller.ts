import { Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';

/**
 * Public payment webhook (no JWT — authenticated by provider signature over the
 * raw request body, captured in main.ts). Point the provider dashboard at
 * POST /api/webhooks/payments/:provider.
 */
@Controller('webhooks/payments')
export class WebhooksController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':provider')
  @HttpCode(200)
  async handle(
    @Param('provider') provider: string,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    const headers = req.headers;
    const signature =
      (headers['x-paystack-signature'] as string | undefined) ??
      (headers['x-mock-signature'] as string | undefined) ??
      (headers['verif-hash'] as string | undefined); // flutterwave
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.payments.handleWebhook(raw, signature);
  }
}
