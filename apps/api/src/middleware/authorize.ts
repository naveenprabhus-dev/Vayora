import type { NextFunction, Request, Response } from 'express';
import { roleHasPermission, type Permission, type UserRole } from '@uaqa/contracts';
import { ForbiddenError, UnauthorizedError } from '../utils/errors.ts';

export function requireRole(...allowedRoles: readonly UserRole[]) {
  const allowed = new Set<UserRole>(allowedRoles);
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.principal) {
      next(new UnauthorizedError());
      return;
    }
    if (!allowed.has(req.principal.role)) {
      next(new ForbiddenError('Insufficient role privileges for this operation.'));
      return;
    }
    next();
  };
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.principal) {
      next(new UnauthorizedError());
      return;
    }
    if (!roleHasPermission(req.principal.role, permission)) {
      next(new ForbiddenError(`Missing required permission: ${permission}.`));
      return;
    }
    next();
  };
}

export function requireOwnership(
  getTargetOwnerUid: (req: Request) => string | undefined,
  options: { allowAdminOverride?: boolean } = {},
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.principal) {
      next(new UnauthorizedError());
      return;
    }

    const targetOwnerUid = getTargetOwnerUid(req);
    if (!targetOwnerUid) {
      next(new ForbiddenError('Resource ownership cannot be verified.'));
      return;
    }

    const isOwner = req.principal.uid === targetOwnerUid;
    const isAllowedAdmin = Boolean(options.allowAdminOverride && req.principal.role === 'admin');

    if (!isOwner && !isAllowedAdmin) {
      next(new ForbiddenError('Access denied: resource belongs to another user.'));
      return;
    }
    next();
  };
}
