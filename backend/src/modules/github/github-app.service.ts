import { Injectable } from '@nestjs/common';
import { SignJWT } from 'jose';
import { ConfigService } from '../../core/config/config.service.js';

// App JWT: GitHub caps lifetime at 10 min; iat is backdated 60 s for clock skew.
const LIFETIME_S = 9 * 60;
const REUSE_MARGIN_S = 60;

@Injectable()
export class GithubAppService {
  private cached?: { jwt: string; exp: number };

  constructor(private readonly config: ConfigService) {}

  async appJwt(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.cached && this.cached.exp - REUSE_MARGIN_S > now)
      return this.cached.jwt;

    const exp = now + LIFETIME_S;
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(String(this.config.get('GITHUB_APP_ID')))
      .setIssuedAt(now - 60)
      .setExpirationTime(exp)
      .sign(this.config.get('GITHUB_APP_PRIVATE_KEY'));
    this.cached = { jwt, exp };
    return jwt;
  }
}
