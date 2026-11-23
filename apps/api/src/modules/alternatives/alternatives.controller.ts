import type { NextFunction, Request, Response } from 'express';
import {
  alternativesCompareQuerySchema,
  alternativesQuerySchema,
  alternativesRefreshBodySchema,
  type AuthenticatedPrincipal,
} from '@uaqa/contracts';
import { UnauthorizedError } from '../../utils/errors.ts';
import { sendSuccess } from '../../utils/response.ts';
import type { SustainableAlternativesService } from './alternatives.service.ts';

function getPrincipalOrThrow(
  principal: AuthenticatedPrincipal | undefined,
): AuthenticatedPrincipal {
  if (!principal) {
    throw new UnauthorizedError();
  }
  return principal;
}

export class AlternativesController {
  private readonly service: SustainableAlternativesService;

  public constructor(service: SustainableAlternativesService) {
    this.service = service;
  }

  public getRecommendations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const query = alternativesQuerySchema.parse(req.query);
      const data = await this.service.getRecommendations(principal.uid, query);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public compareAlternative = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const query = alternativesCompareQuerySchema.parse(req.query);
      const data = await this.service.compareAlternative(principal.uid, query);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public refreshRecommendations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const body = alternativesRefreshBodySchema.parse(req.body ?? {});
      const data = await this.service.refreshRecommendations(principal.uid, body);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };
}
