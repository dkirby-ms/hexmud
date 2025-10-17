import type { AccessTokenClaims } from './validateToken.js';

export const extractRoles = (claims?: AccessTokenClaims): string[] => {
  const roles = new Set<string>(['player']);

  if (!claims) {
    return Array.from(roles);
  }

  if (claims.moderator === true) {
    roles.add('moderator');
  }

  const rawRoles = (claims as { roles?: unknown }).roles;

  if (Array.isArray(rawRoles)) {
    for (const role of rawRoles) {
      if (typeof role !== 'string') {
        continue;
      }

      const normalized = role.trim().toLowerCase();
      if (normalized.length === 0) {
        continue;
      }

      if (normalized === 'moderator') {
        roles.add('moderator');
      } else {
        roles.add(normalized);
      }
    }
  } else if (typeof rawRoles === 'string') {
    const normalized = rawRoles.trim().toLowerCase();
    if (normalized.length > 0) {
      roles.add(normalized === 'moderator' ? 'moderator' : normalized);
    }
  }

  return Array.from(roles);
};
