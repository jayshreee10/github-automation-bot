import {
  type ArgumentsHost,
  BadGatewayException,
  Catch,
  ForbiddenException,
  type HttpException,
  InternalServerErrorException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import {
  AccessDeniedError,
  DomainError,
  UpstreamUnavailableError,
} from './domain.error.js';

// Bare HTTP exceptions keep responses detail-free; the reason stays in server logs only.
function toHttp(err: DomainError): HttpException {
  if (err instanceof AccessDeniedError) return new ForbiddenException();
  if (err instanceof UpstreamUnavailableError) return new BadGatewayException();
  return new InternalServerErrorException();
}

@Catch(DomainError)
export class DomainErrorFilter extends BaseExceptionFilter {
  override catch(err: DomainError, host: ArgumentsHost): void {
    super.catch(toHttp(err), host);
  }
}
