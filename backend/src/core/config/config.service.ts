import { Injectable } from '@nestjs/common';
import { type Env, loadEnv } from './env.js';

@Injectable()
export class ConfigService {
  private readonly env: Env = loadEnv();

  get<K extends keyof Env>(key: K): Env[K] {
    return this.env[key];
  }
}
