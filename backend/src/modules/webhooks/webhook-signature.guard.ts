import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  type RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '../../core/config/config.service.js';

// Verifies X-Hub-Signature-256 over the exact bytes received. Any mismatch is a bare 401, never a reason.
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const header = req.headers['x-hub-signature-256'];
    if (typeof header !== 'string' || !req.rawBody)
      throw new UnauthorizedException();

    const digest = createHmac(
      'sha256',
      this.config.get('GITHUB_WEBHOOK_SECRET'),
    )
      .update(req.rawBody)
      .digest('hex');
    const expected = Buffer.from(`sha256=${digest}`);
    const given = Buffer.from(header);
    // timingSafeEqual throws on unequal lengths, so check that first.
    if (given.length !== expected.length || !timingSafeEqual(given, expected))
      throw new UnauthorizedException();
    return true;
  }
}
