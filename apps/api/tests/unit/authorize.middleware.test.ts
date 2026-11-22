import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { UserRole } from '@uaqa/contracts';
import {
  requireOwnership,
  requirePermission,
  requireRole,
} from '../../src/middleware/authorize.ts';
import { ForbiddenError } from '../../src/utils/errors.ts';

function requestWithUser(uid: string, role: UserRole): Request {
  return {
    principal: {
      uid,
      email: `${uid}@example.org`,
      emailVerified: true,
      role,
      authTimeSeconds: 1700000000,
    },
    params: { ownerUid: 'user_owner_1' },
  } as unknown as Request;
}

describe('authorization middleware', () => {
  it('enforces role allowlists', () => {
    const guard = requireRole('admin');
    const nextDenied = vi.fn();
    guard(requestWithUser('u1', 'regular_user'), {} as Response, nextDenied);
    expect(nextDenied).toHaveBeenCalledWith(expect.any(ForbiddenError));

    const nextAllowed = vi.fn();
    guard(requestWithUser('a1', 'admin'), {} as Response, nextAllowed);
    expect(nextAllowed).toHaveBeenCalledWith();
  });

  it('enforces granular permissions', () => {
    const guard = requirePermission('community_advisory:publish');
    const nextUser = vi.fn();
    guard(requestWithUser('u1', 'regular_user'), {} as Response, nextUser);
    expect(nextUser).toHaveBeenCalledWith(expect.any(ForbiddenError));

    const nextCoordinator = vi.fn();
    guard(requestWithUser('c1', 'community_coordinator'), {} as Response, nextCoordinator);
    expect(nextCoordinator).toHaveBeenCalledWith();
  });

  it('prevents IDOR by blocking non-owners from accessing owned resources', () => {
    const guard = requireOwnership((req) => req.params.ownerUid);

    const nextAttacker = vi.fn();
    guard(requestWithUser('user_attacker_2', 'regular_user'), {} as Response, nextAttacker);
    expect(nextAttacker).toHaveBeenCalledWith(expect.any(ForbiddenError));

    const nextOwner = vi.fn();
    guard(requestWithUser('user_owner_1', 'regular_user'), {} as Response, nextOwner);
    expect(nextOwner).toHaveBeenCalledWith();
  });
});
