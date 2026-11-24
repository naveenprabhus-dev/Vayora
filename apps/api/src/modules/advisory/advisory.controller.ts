import {
  advisoryBriefingQuerySchema,
  advisoryCompareBodySchema,
  advisoryExplainBodySchema,
  advisoryRefreshBodySchema,
} from '@uaqa/contracts';
import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors.ts';
import { sendSuccess } from '../../utils/response.ts';
import type { AdvisoryService } from './advisory.service.ts';

function requirePrincipalUid(req: Request): string {
  const uid = req.principal?.uid;
  if (!uid) {
    throw new UnauthorizedError('Authenticated household identity is required.');
  }
  return uid;
}

export class AdvisoryController {
  private readonly service: AdvisoryService;

  public constructor(service: AdvisoryService) {
    this.service = service;
  }

  public getBriefing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uid = requirePrincipalUid(req);
      const query = advisoryBriefingQuerySchema.parse(req.query);
      const payload = await this.service.getDailyBriefing(uid, query);
      sendSuccess(res, payload, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public explainRecommendation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const uid = requirePrincipalUid(req);
      const body = advisoryExplainBodySchema.parse(req.body);
      const payload = await this.service.explainRecommendation(uid, body);
      sendSuccess(res, payload, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public compareChoices = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const uid = requirePrincipalUid(req);
      const body = advisoryCompareBodySchema.parse(req.body);
      const payload = await this.service.compareChoicesExplanation(uid, body);
      sendSuccess(res, payload, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public refreshBriefing = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const uid = requirePrincipalUid(req);
      const body = advisoryRefreshBodySchema.parse(req.body ?? {});
      const payload = await this.service.refreshAdvisory(uid, body);
      sendSuccess(res, payload, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public getMetrics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      requirePrincipalUid(req);
      const metrics = this.service.getMetricsSnapshot();
      sendSuccess(res, metrics, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };
}
