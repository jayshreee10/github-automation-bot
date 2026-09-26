import { describe, expect, it, vi } from 'vitest';
import { AccessDeniedError } from '../../core/errors/domain.error.js';
import { delivery } from '../../test/fakes.js';
import { HandlerRegistry } from '../queue/handler.registry.js';
import { PermanentJobError } from '../queue/job-errors.js';
import { InstallationEventsHandler } from './installation-events.handler.js';
import type { InstallationsService } from './installations.service.js';

function setup() {
  const installations = {
    removeKnown: vi.fn().mockResolvedValue(true),
    syncKnown: vi.fn().mockResolvedValue(true),
  };
  const registry = new HandlerRegistry();
  const handler = new InstallationEventsHandler(registry, installations as unknown as InstallationsService);
  const handle = (event: string, action: string) =>
    handler.handle(delivery({ event, action, payload: { action, installation: { id: 5 } } }));
  return { handler, registry, installations, handle };
}

describe('InstallationEventsHandler', () => {
  it('registers for installation events on init', () => {
    const { handler, registry } = setup();
    handler.onModuleInit();
    expect(registry.get('installation')).toBe(handler);
    expect(registry.get('installation_repositories')).toBe(handler);
  });

  it('removes the installation when the App is uninstalled', async () => {
    const { installations, handle } = setup();
    await handle('installation', 'deleted');
    expect(installations.removeKnown).toHaveBeenCalledWith(5);
    expect(installations.syncKnown).not.toHaveBeenCalled();
  });

  it.each([
    ['installation_repositories', 'added'],
    ['installation_repositories', 'removed'],
    ['installation', 'unsuspend'],
    ['installation', 'new_permissions_accepted'],
  ])('re-syncs on %s.%s', async (event, action) => {
    const { installations, handle } = setup();
    await handle(event, action);
    expect(installations.syncKnown).toHaveBeenCalledWith(5);
  });

  it.each(['created', 'suspend'])('does nothing on installation.%s', async (action) => {
    const { installations, handle } = setup();
    await handle('installation', action);
    expect(installations.syncKnown).not.toHaveBeenCalled();
    expect(installations.removeKnown).not.toHaveBeenCalled();
  });

  it('turns an owner mismatch into a permanent failure', async () => {
    const { installations, handle } = setup();
    installations.syncKnown.mockRejectedValue(new AccessDeniedError());
    await expect(handle('installation_repositories', 'added')).rejects.toBeInstanceOf(PermanentJobError);
  });

  it('lets other failures retry', async () => {
    const { installations, handle } = setup();
    installations.syncKnown.mockRejectedValue(new Error('GitHub down'));
    await expect(handle('installation_repositories', 'added')).rejects.not.toBeInstanceOf(PermanentJobError);
  });

  it('rejects a malformed payload permanently', async () => {
    const { handler } = setup();
    await expect(handler.handle(delivery({ event: 'installation', payload: { action: 'x' } }))).rejects.toBeInstanceOf(
      PermanentJobError,
    );
  });
});
