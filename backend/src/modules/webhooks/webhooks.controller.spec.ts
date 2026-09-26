import { BadRequestException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { IngestResult } from './webhook.types.js';
import { WebhooksController } from './webhooks.controller.js';
import type { WebhooksService } from './webhooks.service.js';

const HEADERS = {
  'x-github-delivery': '72d3162e-cc78-11e3-81ab-4c9367dc0958',
  'x-github-event': 'issues',
};

function call(result: IngestResult, headers: Record<string, string> = HEADERS, rawBody: Buffer | null = Buffer.from('{}')) {
  const ingest = vi.fn().mockResolvedValue(result);
  const controller = new WebhooksController({ ingest } as unknown as WebhooksService);
  const res = { status: vi.fn() };
  const req = { body: {}, rawBody: rawBody ?? undefined } as unknown as Request & { rawBody?: Buffer };
  return {
    ingest,
    res,
    response: controller.github(headers, req, res as unknown as Response),
  };
}

describe('WebhooksController', () => {
  it.each([
    ['accepted', 202, { accepted: true }],
    ['duplicate', 200, { duplicate: true }],
    ['ping', 200, { ping: true }],
    ['ignored', 204, undefined],
  ] as const)('answers %s with %i', async (result, status, body) => {
    const { res, response } = call(result);
    await expect(response).resolves.toEqual(body);
    expect(res.status).toHaveBeenCalledWith(status);
  });

  it.each([
    ['a non-GUID delivery id', { ...HEADERS, 'x-github-delivery': '1; DROP TABLE' }],
    ['a malformed event name', { ...HEADERS, 'x-github-event': 'Issues!' }],
    ['a missing event header', { 'x-github-delivery': HEADERS['x-github-delivery'] }],
  ])('rejects %s before ingesting', async (_name, headers) => {
    const { ingest, response } = call('accepted', headers);
    await expect(response).rejects.toBeInstanceOf(BadRequestException);
    expect(ingest).not.toHaveBeenCalled();
  });

  it('rejects a request without a raw body', async () => {
    const { response } = call('accepted', HEADERS, null);
    await expect(response).rejects.toBeInstanceOf(BadRequestException);
  });
});
