import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Opts a route out of the global auth guard. Use only for health checks and signature-verified webhooks.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
