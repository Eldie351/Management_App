import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SECRET_PAR_DEFAUT_A_CHANGER',
    });
  }

  async validate(payload: any) {
    const rawUser = payload.email
      ? await this.usersService.findByEmail(payload.email)
      : await this.usersService.findById(payload.sub || payload.id);

    if (!rawUser) {
      throw new UnauthorizedException('Jeton invalide ou utilisateur supprimé.');
    }

    const user = rawUser as any;

    // Extraire proprement tous les IDs de magasins associés
    const ownedStoreIds = user.ownedStores?.map((s: any) => s.id) ?? [];
    const assignedStoreIds = user.storeAssignments?.map((sa: any) => sa.storeId) ?? [];

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      assignedStoreId: user.assignedStoreId ?? null,
      ownedStores: user.ownedStores ?? [], // Conservé si votre frontend a besoin des objets
      ownedStoreIds,                       // Pratique pour les clauses Prisma `in: [...]`
      storeAssignments: user.storeAssignments ?? [],
      assignedStoreIds,                   // Pratique pour les clauses Prisma `in: [...]`
    };
  }
}