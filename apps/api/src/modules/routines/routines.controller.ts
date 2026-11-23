import type { NextFunction, Request, Response } from 'express';
import {
  routinesQuerySchema,
  routinesRefreshBodySchema,
  type AuthenticatedPrincipal,
} from '@uaqa/contracts';
import { UnauthorizedError } from '../../utils/errors.ts';
import { sendSuccess } from '../../utils/response.ts';
import type { RoutinesService } from './routines.service.ts';

function getPrincipalOrThrow(
  principal: AuthenticatedPrincipal | undefined,
): AuthenticatedPrincipal {
  if (!principal) {
    throw new UnauthorizedError();
  }
  return principal;
}

export class RoutinesController {
  private readonly service: RoutinesService;

  public constructor(service: RoutinesService) {
    this.service = service;
  }

  public getDaily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const query = routinesQuerySchema.parse(req.query);
      const data = await this.service.getDailyRoutines(principal.uid, query);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public refreshDaily = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const body = routinesRefreshBodySchema.parse(req.body ?? {});
      const data = await this.service.refreshDailyRoutines(principal.uid, body);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };
}
