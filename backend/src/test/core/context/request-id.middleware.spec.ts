import { Body, Controller, Get, type MiddlewareConsumer, Module, type NestModule, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { requestContext } from '../../../core/context/request-context.js';
import { requestIdMiddleware } from '../../../core/context/request-id.middleware.js';

const UUID = '9b2f4c1e-3a5d-4e6f-8a7b-1c2d3e4f5a6b';

function call(headers: Record<string, string>) {
  const req = { headers } as unknown as Request;
  const res = { setHeader: vi.fn() };
  let ctx: unknown;
  requestIdMiddleware(req, res as unknown as Response, () => {
    ctx = requestContext.get();
  });
  return { res, ctx: ctx as { requestId: string } };
}

describe('requestIdMiddleware', () => {
  it('reuses an incoming UUID and echoes it', () => {
    const { res, ctx } = call({ 'x-request-id': UUID });
    expect(ctx.requestId).toBe(UUID);
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', UUID);
  });

  it.each([
    ['missing', {}],
    ['not a UUID', { 'x-request-id': 'abc\nFAKE LOG LINE' }],
  ])('generates a UUID when the header is %s', (_, headers) => {
    const { ctx } = call(headers);
    expect(ctx.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(ctx.requestId).not.toContain('FAKE');
  });
});

// A real Nest app: the context must survive the body parser and reach guards and controllers.
@Controller('ctx')
class ContextController {
  @Get()
  get() {
    return requestContext.get();
  }

  @Post()
  async post(@Body() body: { deliveryId: string }) {
    requestContext.set({ deliveryId: body.deliveryId });
    await new Promise((resolve) => setTimeout(resolve, 1));
    return requestContext.get();
  }
}

@Module({ controllers: [ContextController] })
class TestModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('{*splat}');
  }
}

describe('request context in a Nest app', () => {
  let app: NestExpressApplication;
  let base: string;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(TestModule, { logger: false, rawBody: true });
    app.useBodyParser('json', { limit: '5mb' });
    app.setGlobalPrefix('api');
    await app.listen(0);
    base = `${await app.getUrl()}/api/ctx`;
  });

  afterAll(() => app.close());

  it('exposes the request id to handlers and in the response header', async () => {
    const res = await fetch(base, { headers: { 'x-request-id': UUID } });
    expect(res.headers.get('x-request-id')).toBe(UUID);
    expect(await res.json()).toEqual({ requestId: UUID });
  });

  it('keeps the context through JSON body parsing', async () => {
    const res = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deliveryId: 'd-1' }),
    });
    const body = (await res.json()) as { requestId: string; deliveryId: string };
    expect(body.deliveryId).toBe('d-1');
    expect(body.requestId).toBe(res.headers.get('x-request-id'));
  });
});
