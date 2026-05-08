import {
  BadRequestException,
  Controller,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';

interface IncomingWebhookRequest {
  rawBody?: Buffer;
  headers: Record<string, string | string[] | undefined>;
}

@Controller('billing/webhooks')
export class RevenueCatWebhookController {
  constructor(private readonly revenueCatWebhookService: RevenueCatWebhookService) {}

  @Post('revenuecat')
  @HttpCode(200)
  async receive(@Req() req: IncomingWebhookRequest) {
    const raw = req.rawBody;
    if (!Buffer.isBuffer(raw) || raw.length === 0) {
      throw new BadRequestException('Missing webhook raw body buffer.');
    }

    this.revenueCatWebhookService.verifyRequest(req.headers, raw);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString('utf8'));
    } catch {
      throw new BadRequestException('Webhook body is not valid JSON.');
    }

    await this.revenueCatWebhookService.handlePayload(parsed);
    return { ok: true };
  }
}
