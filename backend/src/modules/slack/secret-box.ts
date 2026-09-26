import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '../../core/config/config.service.js';

const VERSION = 'v1';

// A stored value that no longer decrypts (key rotated, row tampered with).
export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretBoxError';
  }
}

// AES-256-GCM for secrets at rest. The context (e.g. user id) is bound as AAD, so a value copied to another row fails.
@Injectable()
export class SecretBox {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    this.key = config.get('SETTINGS_ENCRYPTION_KEY');
  }

  seal(plain: string, context: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(context));
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const parts = [iv, cipher.getAuthTag(), data].map((b) =>
      b.toString('base64'),
    );
    return [VERSION, ...parts].join(':');
  }

  open(sealed: string, context: string): string {
    const [version, iv, tag, data] = sealed.split(':');
    if (version !== VERSION || !iv || !tag || !data)
      throw new SecretBoxError('unknown secret format');
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(iv, 'base64'),
      );
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(data, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new SecretBoxError('secret could not be decrypted');
    }
  }
}
