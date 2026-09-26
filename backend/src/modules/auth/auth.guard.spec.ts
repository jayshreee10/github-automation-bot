import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { httpContext } from '../../test/fakes.js';
import { AuthGuard } from './auth.guard.js';
import type { AuthService } from './auth.service.js';
import { Public } from './public.decorator.js';

class Routes {
  @Public()
  open() {}
  closed() {}
}

const USER = { id: 'u1', email: null, name: null };

function setup() {
  const verify = vi.fn().mockResolvedValue(USER);
  const guard = new AuthGuard(new Reflector(), { verify } as unknown as AuthService);
  const run = (headers: Record<string, string>, handler: () => void = Routes.prototype.closed) => {
    const req: Record<string, unknown> = { headers };
    const ctx = httpContext(req);
    ctx.getHandler = () => handler;
    ctx.getClass = (() => Routes) as ExecutionContext['getClass'];
    return { req, result: guard.canActivate(ctx) };
  };
  return { verify, run };
}

describe('AuthGuard', () => {
  it('lets @Public() routes through without a token', async () => {
    const { verify, run } = setup();
    await expect(run({}, Routes.prototype.open).result).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it.each([
    ['no header', {}],
    ['a non-Bearer scheme', { authorization: 'Basic abc' }],
    ['an empty token', { authorization: 'Bearer ' }],
  ])('rejects %s', async (_name, headers) => {
    const { verify, run } = setup();
    await expect(run(headers).result).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('verifies the Bearer token and attaches the user', async () => {
    const { verify, run } = setup();
    const { req, result } = run({ authorization: 'Bearer jwt-1' });
    await expect(result).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('jwt-1');
    expect(req.user).toEqual(USER);
  });

  it('propagates a verification failure', async () => {
    const { verify, run } = setup();
    verify.mockRejectedValue(new UnauthorizedException());
    await expect(run({ authorization: 'Bearer bad' }).result).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
