import {
  type ArgumentsHost,
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  type HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { DomainErrorFilter } from '../../../core/errors/domain-error.filter.js';
import {
  AccessDeniedError,
  ConflictError,
  DomainError,
  InvalidInputError,
  NotFoundError,
  UpstreamUnavailableError,
} from '../../../core/errors/domain.error.js';
import { errorMessage } from '../../../core/errors/error-message.js';

class OtherDomainError extends DomainError {}

function mapped(err: DomainError): HttpException {
  const parent = vi
    .spyOn(BaseExceptionFilter.prototype, 'catch')
    .mockImplementation(() => {});
  new DomainErrorFilter().catch(err, {} as ArgumentsHost);
  return parent.mock.calls[0][0] as HttpException;
}

describe('DomainErrorFilter', () => {
  it.each([
    [new AccessDeniedError('secret detail'), ForbiddenException],
    [new NotFoundError('rule 123'), NotFoundException],
    [new ConflictError('job j1 is pending'), ConflictException],
    [new UpstreamUnavailableError('GitHub 500'), BadGatewayException],
    [new OtherDomainError('x'), InternalServerErrorException],
  ])('maps %s to a detail-free response', (err, Expected) => {
    const http = mapped(err);
    expect(http).toBeInstanceOf(Expected);
    expect(JSON.stringify(http.getResponse())).not.toContain(err.message);
  });

  it('passes our own invalid-input message through as 400', () => {
    const http = mapped(new InvalidInputError('push rules only support slack_notify'));
    expect(http).toBeInstanceOf(BadRequestException);
    expect(http.message).toBe('push rules only support slack_notify');
  });
});

describe('DomainError', () => {
  it('names each error after its class', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
    expect(new AccessDeniedError().message).toBe('access denied');
  });
});

describe('errorMessage', () => {
  it('reads Error messages and stringifies anything else', () => {
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(42)).toBe('42');
  });
});
