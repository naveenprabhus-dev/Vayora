export const USER_ROLES = ['regular_user', 'community_coordinator', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export type Permission =
  | 'profile:read_own'
  | 'profile:write_own'
  | 'air_quality:read'
  | 'recommendations:read_own'
  | 'recommendations:generate_own'
  | 'community_advisory:read'
  | 'community_advisory:publish'
  | 'system:audit_read'
  | 'roles:manage';

export const ROLE_PERMISSIONS: Readonly<Record<UserRole, readonly Permission[]>> = {
  regular_user: [
    'profile:read_own',
    'profile:write_own',
    'air_quality:read',
    'recommendations:read_own',
    'recommendations:generate_own',
    'community_advisory:read',
  ],
  community_coordinator: [
    'profile:read_own',
    'profile:write_own',
    'air_quality:read',
    'recommendations:read_own',
    'recommendations:generate_own',
    'community_advisory:read',
    'community_advisory:publish',
  ],
  admin: [
    'profile:read_own',
    'profile:write_own',
    'air_quality:read',
    'recommendations:read_own',
    'recommendations:generate_own',
    'community_advisory:read',
    'community_advisory:publish',
    'system:audit_read',
    'roles:manage',
  ],
} as const;

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
