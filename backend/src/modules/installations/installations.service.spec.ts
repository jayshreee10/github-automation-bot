import { describe, expect, it, vi } from 'vitest';
import {
  AccessDeniedError,
  UpstreamUnavailableError,
} from '../../core/errors/domain.error.js';
import { GithubApiError } from '../github/github-client.js';
import type { GithubService } from '../github/github.service.js';
import type { InstallationTokenService } from '../github/installation-token.service.js';
import type { GithubIdentityService } from '../users/github-identity.service.js';
import type { InstallationsRepository } from './installations.repository.js';
import { InstallationsService } from './installations.service.js';

const ACCOUNT = { id: 100, login: 'alice', type: 'User' };
const REPOS = [{ id: 1, full_name: 'alice/app', private: true }];

function setup() {
  const repo = {
    isOwnedBy: vi.fn().mockResolvedValue(true),
    findOwnerId: vi.fn().mockResolvedValue('user-1'),
    saveWithRepos: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    deleteIfExists: vi.fn().mockResolvedValue(true),
    listForUser: vi.fn().mockResolvedValue([]),
  };
  const github = {
    getInstallation: vi.fn().mockResolvedValue({ id: 5, account: ACCOUNT }),
    listInstallationRepos: vi.fn().mockResolvedValue(REPOS),
  };
  const tokens = { forget: vi.fn() };
  const identity = { githubUserId: vi.fn().mockResolvedValue(100) };
  const service = new InstallationsService(
    repo as unknown as InstallationsRepository,
    github as unknown as GithubService,
    tokens as unknown as InstallationTokenService,
    identity as unknown as GithubIdentityService,
  );
  return { service, repo, github, tokens, identity };
}

describe('InstallationsService', () => {
  describe('connect', () => {
    it('stores the installation and repos when GitHub says the caller owns it', async () => {
      const { service, repo } = setup();
      await service.connect('user-1', 5);
      expect(repo.saveWithRepos).toHaveBeenCalledWith(5, 'user-1', ACCOUNT, REPOS);
      expect(repo.listForUser).toHaveBeenCalledWith('user-1');
    });

    it.each([
      ['the caller has no GitHub identity', { githubUserId: null }],
      ['the account belongs to someone else', { account: { ...ACCOUNT, id: 999 } }],
      ['the account is an organisation', { account: { ...ACCOUNT, type: 'Organization' } }],
    ])('denies access when %s', async (_name, change) => {
      const { service, repo, github, identity } = setup();
      if ('githubUserId' in change) identity.githubUserId.mockResolvedValue(change.githubUserId);
      if ('account' in change) github.getInstallation.mockResolvedValue({ id: 5, account: change.account });
      await expect(service.connect('user-1', 5)).rejects.toBeInstanceOf(AccessDeniedError);
      expect(repo.saveWithRepos).not.toHaveBeenCalled();
    });

    it('maps a GitHub 404 to access denied', async () => {
      const { service, github } = setup();
      github.getInstallation.mockRejectedValue(new GithubApiError(404, '/x'));
      await expect(service.connect('user-1', 5)).rejects.toBeInstanceOf(AccessDeniedError);
    });

    it('maps other GitHub failures to upstream unavailable', async () => {
      const { service, github } = setup();
      github.listInstallationRepos.mockRejectedValue(new GithubApiError(502, '/x'));
      await expect(service.connect('user-1', 5)).rejects.toBeInstanceOf(UpstreamUnavailableError);
    });
  });

  describe('sync', () => {
    it('refuses an installation the caller does not own, without calling GitHub', async () => {
      const { service, repo, github } = setup();
      repo.isOwnedBy.mockResolvedValue(false);
      await expect(service.sync('user-1', 5)).rejects.toBeInstanceOf(AccessDeniedError);
      expect(github.getInstallation).not.toHaveBeenCalled();
    });

    it('removes the installation locally when GitHub no longer has it', async () => {
      const { service, repo, github, tokens } = setup();
      github.getInstallation.mockRejectedValue(new GithubApiError(404, '/x'));
      await expect(service.sync('user-1', 5)).resolves.toEqual({ installations: [], repositories: [] });
      expect(repo.delete).toHaveBeenCalledWith(5);
      expect(tokens.forget).toHaveBeenCalledWith(5);
    });

    it('keeps the installation when access is denied but it still exists', async () => {
      const { service, repo, github } = setup();
      github.getInstallation.mockResolvedValue({ id: 5, account: { ...ACCOUNT, id: 999 } });
      await expect(service.sync('user-1', 5)).rejects.toBeInstanceOf(AccessDeniedError);
      expect(repo.delete).not.toHaveBeenCalled();
    });
  });

  describe('webhook-triggered', () => {
    it('syncKnown re-syncs as the stored owner', async () => {
      const { service, repo } = setup();
      await expect(service.syncKnown(5)).resolves.toBe(true);
      expect(repo.saveWithRepos).toHaveBeenCalledWith(5, 'user-1', ACCOUNT, REPOS);
    });

    it('syncKnown ignores unknown installations', async () => {
      const { service, repo, github } = setup();
      repo.findOwnerId.mockResolvedValue(null);
      await expect(service.syncKnown(5)).resolves.toBe(false);
      expect(github.getInstallation).not.toHaveBeenCalled();
    });

    it('removeKnown deletes and forgets the token', async () => {
      const { service, repo, tokens } = setup();
      repo.deleteIfExists.mockResolvedValue(false);
      await expect(service.removeKnown(5)).resolves.toBe(false);
      expect(tokens.forget).toHaveBeenCalledWith(5);
    });
  });

  it('list returns ids as strings and keeps installations with no repos', async () => {
    const { service, repo } = setup();
    repo.listForUser.mockResolvedValue([
      {
        id: 9007199254740993n,
        githubAccountLogin: 'alice',
        repositories: [{ id: 12n, fullName: 'alice/app', isPrivate: true }],
      },
      { id: 6n, githubAccountLogin: 'bob', repositories: [] },
    ]);
    await expect(service.list('user-1')).resolves.toEqual({
      installations: [
        { id: '9007199254740993', accountLogin: 'alice' },
        { id: '6', accountLogin: 'bob' },
      ],
      repositories: [
        {
          id: '12',
          fullName: 'alice/app',
          isPrivate: true,
          installationId: '9007199254740993',
          accountLogin: 'alice',
        },
      ],
    });
  });
});
