import type { NextFunction, Request, Response } from 'express';
import {
  airQualityQuerySchema,
  locationUpdateSchema,
  type AuthenticatedPrincipal,
} from '@uaqa/contracts';
import { UnauthorizedError } from '../../utils/errors.ts';
import { sendSuccess } from '../../utils/response.ts';
import type { AirQualityService } from './air-quality.service.ts';

function getPrincipalOrThrow(
  principal: AuthenticatedPrincipal | undefined,
): AuthenticatedPrincipal {
  if (!principal) {
    throw new UnauthorizedError();
  }
  return principal;
}

export class AirQualityController {
  private readonly service: AirQualityService;

  public constructor(service: AirQualityService) {
    this.service = service;
  }

  public getCurrent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const query = airQualityQuerySchema.parse(req.query);
      const data = await this.service.getCurrentAirQuality(principal.uid, query);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public getForecast = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const query = airQualityQuerySchema.parse(req.query);
      const data = await this.service.getForecast(principal.uid, query);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public getPollutants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const query = airQualityQuerySchema.parse(req.query);
      const data = await this.service.getPollutants(principal.uid, query);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public getGuidance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const query = airQualityQuerySchema.parse(req.query);
      const data = await this.service.getGuidance(principal.uid, query);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public updateLocation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const principal = getPrincipalOrThrow(req.principal);
      const body = locationUpdateSchema.parse(req.body);
      const data = await this.service.updateHouseholdLocation(principal.uid, body);
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };

  public getHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      getPrincipalOrThrow(req.principal);
      const data = await this.service.getHealthStatus();
      sendSuccess(res, data, 200, req.context?.requestId);
    } catch (error) {
      next(error);
    }
  };
}
