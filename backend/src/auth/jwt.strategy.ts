import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      // Extrait le token du header 'Authorization: Bearer <TOKEN>'
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'SECRET_PAR_DEFAUT_A_CHANGER',
    });
  }

  // Cette fonction s'exécute automatiquement si le jeton est valide
  async validate(payload: { sub: number; email: string }) {
    const user = await this.usersService.findByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('Jeton invalide ou utilisateur supprimé.');
    }
    // Ce qui est retourné ici sera accessible dans 'req.user' dans vos contrôleurs
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      assignedStoreId: user.assignedStoreId,
    };
  }
}
