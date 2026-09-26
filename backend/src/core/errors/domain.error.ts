// Business-level failures, free of HTTP. The global filter maps each kind to a status; job handlers match on class.
export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// The caller may not act on this resource (unknown, not theirs, or no longer theirs).
export class AccessDeniedError extends DomainError {
  constructor(message = 'access denied') {
    super(message);
  }
}

// An upstream service (e.g. GitHub) failed for a reason the caller cannot fix.
export class UpstreamUnavailableError extends DomainError {
  constructor(message = 'upstream unavailable') {
    super(message);
  }
}

// Unknown or not the caller's: both return 404 so resource ids owned by others are not revealed.
export class NotFoundError extends DomainError {
  constructor(message = 'not found') {
    super(message);
  }
}

// The resource exists but its current state forbids the request, e.g. retrying a job that is not failed.
export class ConflictError extends DomainError {
  constructor(message = 'conflict') {
    super(message);
  }
}

// Input passed schema checks alone but breaks a rule once combined with stored state.
export class InvalidInputError extends DomainError {
  constructor(message = 'invalid input') {
    super(message);
  }
}
