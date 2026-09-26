import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { HandlerRegistry } from '../../../modules/queue/handler.registry.js';
import type { WebhookDeliveryRepository } from '../../../modules/webhooks/webhook-delivery.repository.js';
import { WebhooksService } from '../../../modules/webhooks/webhooks.service.js';

const GUID = '72d3162e-cc78-11e3-81ab-4c9367dc0958';

function setup(inserted = true) {
  const registry = new HandlerRegistry();
  registry.register({ events: ['issues'], handle: vi.fn() });
  const deliveries = { insertWithJob: vi.fn().mockResolvedValue(inserted) };
  const service = new WebhooksService(
    deliveries as unknown as WebhookDeliveryRepository,
    registry,
  );
  const ingest = (event: string, body: unknown, raw = JSON.stringify(body)) =>
    service.ingest(
      { 'x-github-delivery': GUID, 'x-github-event': event },
      body,
      Buffer.from(raw),
    );
  return { deliveries, ingest };
}

describe('WebhooksService.ingest', () => {
  it('stores a handled event with its raw bytes and returns accepted', async () => {
    const { deliveries, ingest } = setup();
    const raw = '{ "action": "opened", "repository": { "id": 42 } }';
    await expect(ingest('issues', JSON.parse(raw), raw)).resolves.toBe('accepted');
    expect(deliveries.insertWithJob).toHaveBeenCalledWith({
      id: GUID,
      event: 'issues',
      action: 'opened',
      repositoryId: 42n,
      rawJson: raw,
    });
  });

  it('returns duplicate when the delivery id is already stored', async () => {
    const { ingest } = setup(false);
    await expect(ingest('issues', { action: 'opened' })).resolves.toBe('duplicate');
  });

  it('stores null action and repository when absent', async () => {
    const { deliveries, ingest } = setup();
    await ingest('issues', {});
    expect(deliveries.insertWithJob).toHaveBeenCalledWith(
      expect.objectContaining({ action: null, repositoryId: null }),
    );
  });

  it('answers ping without storing', async () => {
    const { deliveries, ingest } = setup();
    await expect(ingest('ping', { zen: 'hi' })).resolves.toBe('ping');
    expect(deliveries.insertWithJob).not.toHaveBeenCalled();
  });

  it('ignores events without a handler', async () => {
    const { deliveries, ingest } = setup();
    await expect(ingest('star', { action: 'created' })).resolves.toBe('ignored');
    expect(deliveries.insertWithJob).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-object body', 'hello'],
    ['a negative repository id', { repository: { id: -1 } }],
  ])('rejects %s with 400', async (_name, body) => {
    const { ingest } = setup();
    await expect(ingest('issues', body)).rejects.toBeInstanceOf(BadRequestException);
  });
});
