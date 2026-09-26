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
