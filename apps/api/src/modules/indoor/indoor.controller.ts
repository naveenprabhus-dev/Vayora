import type { NextFunction, Request, Response } from 'express';
import {
  indoorGuidanceQuerySchema,
  indoorGuidanceRefreshBodySchema,
  type AuthenticatedPrincipal,
} from '@uaqa/contracts';
import { UnauthorizedError } from '../../utils/errors.ts';
import { sendSuccess } from '../../utils/response.ts';
import type { IndoorAirService } from './indoor.service.ts';

function getPrincipalOrThrow(
  principal: AuthenticatedPrincipal | undefined,
): AuthenticatedPrincipal {
  if (!principal) {
    throw new UnauthorizedError();
  }
  return principal;
}

export class IndoorController {
  private readonly service: IndoorAirService;

  public constructor(service: IndoorAirService) {
    this.service = service;
  }

  public getGuidance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const query = indoorGuidanceQuerySchema.parse(req.query);
      const data = await this.service.getIndoorAirGuidance(principal.uid, query);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public refreshGuidance = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const body = indoorGuidanceRefreshBodySchema.parse(req.body ?? {});
      const data = await this.service.refreshIndoorAirGuidance(principal.uid, body);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };
}
