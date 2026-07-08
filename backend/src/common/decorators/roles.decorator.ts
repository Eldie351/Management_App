import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restreint une route à une liste de rôles.
 * Doit être combiné avec RolesGuard : @UseGuards(AuthGuard('jwt'), RolesGuard).
 * Sans ce décorateur sur une route, RolesGuard laisse passer tout utilisateur
 * authentifié (pas de restriction par défaut).
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
