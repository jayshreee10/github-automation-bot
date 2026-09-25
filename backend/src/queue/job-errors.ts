// Retrying cannot help (e.g. malformed payload), so the job goes straight to dead. Any other error is transient.
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentJobError';
  }
}
