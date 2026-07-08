import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
  Body,
  UseGuards,
  ForbiddenException,
  Request,
  Post,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from './users.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';

const { ADMIN } = UserRole;

/**
 * "Gérer utilisateurs" / "Modifier rôles" : ADMIN uniquement.
 *
 * ⚠️ LIMITE ACTUELLE DU MODÈLE DE DONNÉES : un magasin (Store) n'a qu'un seul
 * propriétaire (Store.userId) et User.role est un attribut global au compte,
 * pas un rôle "par magasin". Il n'existe donc pas encore de notion d'équipe
 * rattachée à un magasin précis. Ce contrôleur gère TOUS les utilisateurs du
 * système, pas seulement ceux d'un magasin donné.
 *
 * Si le besoin réel est "chaque ADMIN gère les MANAGER/CASHIER de SES
 * magasins", il faudra une table de jointure (ex: StoreMember avec
 * storeId + userId + role) et ces routes devront être adaptées en
 * conséquence — dis-le moi et je fais la migration.
 */
@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Post('staff')
  async createStaffUser(@Body() dto: CreateStaffUserDto) {
    return this.usersService.createStaffUser(dto);
  }

  @Patch(':id/role')
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
    @Request() req,
  ) {
    if (req.user.id === id) {
      throw new ForbiddenException('Tu ne peux pas modifier ton propre rôle.');
    }
    return this.usersService.updateRole(id, dto.role);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    if (req.user.id === id) {
      throw new ForbiddenException(
        'Tu ne peux pas supprimer ton propre compte.',
      );
    }
    await this.usersService.delete(id);
    return { message: 'Utilisateur supprimé avec succès.' };
  }
}
