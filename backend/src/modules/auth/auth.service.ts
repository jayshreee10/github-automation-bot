import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { ConfigService } from '../../core/config/config.service.js';
import type { AuthUser } from './auth.types.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  // JWKS is fetched lazily and cached by jose, which also refetches on unknown key ids (rotation).
  constructor(config: ConfigService) {
    const authUrl = config.get('NEON_AUTH_URL').replace(/\/$/, '');
    this.issuer = new URL(authUrl).origin;
    this.jwks = createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<AuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        algorithms: ['EdDSA'],
      });
      if (!payload.sub) throw new errors.JWTClaimValidationFailed('missing sub', payload, 'sub');

      return {
        id: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : null,
        name: typeof payload.name === 'string' ? payload.name : null,
      };
    } catch (err) {
      // Log only the failure code; the token itself never reaches the logs.
      const reason = err instanceof errors.JOSEError ? err.code : 'ERR_UNKNOWN';
      this.logger.warn(`JWT rejected: ${reason}`);
      throw new UnauthorizedException();
    }
  }
}
