import {
  type ArgumentsHost,
  BadGatewayException,
  BadRequestException,
  Catch,
  ConflictException,
  ForbiddenException,
  type HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import {
  AccessDeniedError,
  ConflictError,
  DomainError,
  InvalidInputError,
  NotFoundError,
  UpstreamUnavailableError,
} from './domain.error.js';

// Bare HTTP exceptions keep responses detail-free; only invalid-input messages, written by us, reach the caller.
function toHttp(err: DomainError): HttpException {
  if (err instanceof AccessDeniedError) return new ForbiddenException();
  if (err instanceof InvalidInputError)
    return new BadRequestException(err.message);
  if (err instanceof NotFoundError) return new NotFoundException();
  if (err instanceof ConflictError) return new ConflictException();
  if (err instanceof UpstreamUnavailableError) return new BadGatewayException();
  return new InternalServerErrorException();
}

@Catch(DomainError)
export class DomainErrorFilter extends BaseExceptionFilter {
  override catch(err: DomainError, host: ArgumentsHost): void {
    super.catch(toHttp(err), host);
  }
}
