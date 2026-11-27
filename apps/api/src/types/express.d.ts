import type { AuthenticatedPrincipal } from '@uaqa/contracts';

export type { AuthenticatedPrincipal };

export interface RequestContext {
  readonly requestId: string;
  readonly startedAtMs: number;
}

declare global {
  namespace Express {
    interface Request {
      principal?: AuthenticatedPrincipal;
      context?: RequestContext;
    }
  }
}
