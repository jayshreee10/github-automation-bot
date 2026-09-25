import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  type RawBodyRequest,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../auth/public.decorator.js';
import { WebhookSignatureGuard } from './webhook-signature.guard.js';
import {
  type IngestResult,
  ingestResponseSchema,
  webhookHeadersSchema,
} from './webhook.types.js';
import { WebhooksService } from './webhooks.service.js';

const RESPONSES: Record<IngestResult, { status: number; body?: object }> = {
  accepted: { status: 202, body: { accepted: true } },
  duplicate: { status: 200, body: { duplicate: true } },
  ping: { status: 200, body: { ping: true } },
  ignored: { status: 204 },
};

// Public, but every request must carry a valid GitHub signature (checked by the guard before this runs).
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooks: WebhooksService) {}

  @Public()
  @Post('github')
  @HttpCode(202)
  @UseGuards(WebhookSignatureGuard)
  @ApiAcceptedResponse({
    description: 'Stored and queued',
    standardSchema: ingestResponseSchema,
  })
  @ApiOkResponse({ description: 'Duplicate delivery or ping; nothing stored' })
  @ApiNoContentResponse({ description: 'Event type not handled' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid signature' })
  @ApiBadRequestResponse({ description: 'Missing or malformed headers' })
  @ApiInternalServerErrorResponse({
    description: 'Not stored; GitHub records a failed delivery for catch-up',
  })
  async github(
    @Headers() rawHeaders: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<object | undefined> {
    const headers = webhookHeadersSchema.safeParse(rawHeaders);
    if (!headers.success || !req.rawBody) throw new BadRequestException();

    const result = await this.webhooks.ingest(
      headers.data,
      req.body,
      req.rawBody,
    );
    this.logger.log(
      `Delivery ${headers.data['x-github-delivery']} ${headers.data['x-github-event']}: ${result}`,
    );
    const { status, body } = RESPONSES[result];
    res.status(status);
    return body;
  }
}
