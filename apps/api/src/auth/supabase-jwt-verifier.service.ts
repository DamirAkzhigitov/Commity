import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey } from 'node:crypto';
import * as jwt from 'jsonwebtoken';

type RsaJwk = Record<string, unknown> & {
  kid?: string;
  kty?: string;
};

type JwksResponse = {
  keys: RsaJwk[];
};

@Injectable()
export class SupabaseJwtVerifierService {
  private jwksCache: JwksResponse | null = null;
  private jwksFetchedAt = 0;
  private readonly jwksTtlMs = 60_000;

  constructor(private readonly config: ConfigService) {}

  private async fetchJwks(): Promise<JwksResponse> {
    const now = Date.now();
    if (this.jwksCache && now - this.jwksFetchedAt < this.jwksTtlMs) {
      return this.jwksCache;
    }
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is required for JWT verification.');
    }
    const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`JWKS request failed with status ${res.status}.`);
    }
    this.jwksCache = (await res.json()) as JwksResponse;
    this.jwksFetchedAt = now;
    return this.jwksCache;
  }

  async verifyJwt(token: string): Promise<jwt.JwtPayload> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL is required for JWT verification.');
    }
    const audRaw = this.config.get<string>('SUPABASE_JWT_AUD') ?? 'authenticated';
    const audiences = audRaw.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    const audList = audiences.length > 0 ? audiences : ['authenticated'];
    const audience: jwt.VerifyOptions['audience'] =
      audList.length === 1 ? audList[0]! : (audList as [string, ...string[]]);
    const issuer = `${supabaseUrl.replace(/\/$/, '')}/auth/v1`;

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    const alg = decoded.header.alg;
    if (alg !== 'RS256' && alg !== 'ES256') {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    const jwks = await this.fetchJwks();
    const jwk = jwks.keys.find((k) => k.kid === decoded.header.kid);
    if (!jwk || !jwk.kid) {
      throw new UnauthorizedException('Invalid or expired token.');
    }

    const publicKey = createPublicKey({ key: jwk, format: 'jwk' });

    try {
      const payload = jwt.verify(token, publicKey, {
        issuer,
        audience,
        algorithms: [alg as jwt.Algorithm],
        clockTolerance: 120,
      });
      if (typeof payload === 'string' || !payload) {
        throw new UnauthorizedException('Invalid or expired token.');
      }
      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new UnauthorizedException('Invalid or expired token.');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}
