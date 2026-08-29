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
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';

/**
 * Gestion des utilisateurs et du personnel.
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // --- Profil utilisateur (Accessible par tous les rôles) -----------------

  /**
   * Récupérer le profil de l'utilisateur connecté avec tous ses magasins.
   */
  @Get('me')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.CASHIER)
  async getProfile(@CurrentUser('id') userId: number) {
    return this.usersService.findProfileWithStores(userId);
  }

  // --- Gestion du personnel par l'ADMIN -----------------------------------

  /**
   * Lister le personnel créé par l'administrateur connecté.
   *
   * BUGFIX (critique) : cet endpoint appelait auparavant un `findAll()` sans
   * filtre, qui renvoyait les utilisateurs de TOUS les commerces de
   * l'application (fuite de données entre clients). Il est maintenant
   * strictement scopé à l'équipe de l'admin connecté — comme /users/staff,
   * qu'il duplique désormais volontairement pour compatibilité.
   */
  @Get()
  @Roles(UserRole.ADMIN)
  async findAll(@CurrentUser('id') adminId: number) {
    return this.usersService.findCreatedByAdmin(adminId);
  }

  /**
   * Créer un membre du personnel (Manager ou Caissier).
   */
  @Post('staff')
  @Roles(UserRole.ADMIN)
  async createStaff(
    @Body() dto: CreateStaffUserDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.usersService.createStaffUser(dto, adminId);
  }

  /**
   * Lister les comptes créés par l'administrateur.
   */
  @Get('staff')
  @Roles(UserRole.ADMIN)
  async findStaffCreatedByAdmin(@CurrentUser('id') adminId: number) {
    return this.usersService.findCreatedByAdmin(adminId);
  }

  /**
   * Modifier le rôle d'un utilisateur.
   * BUGFIX : la vérification d'appartenance à l'équipe de l'admin est
   * désormais faite dans UsersService.updateRole (createdById === adminId).
   */
  @Patch(':id/role')
  @Roles(UserRole.ADMIN)
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('id') currentUserId: number,
  ) {
    if (currentUserId === id) {
      throw new ForbiddenException('Tu ne peux pas modifier ton propre rôle.');
    }
    return this.usersService.updateRole(id, dto.role, currentUserId);
  }

  /**
   * Supprimer un compte utilisateur.
   * BUGFIX : délègue maintenant à `deleteStaffMember`, qui vérifie que la
   * cible a bien été créée par l'admin appelant avant de la supprimer
   * (auparavant, n'importe quel ADMIN pouvait supprimer n'importe quel
   * compte du système, y compris celui d'un autre commerce).
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentUserId: number,
  ) {
    if (currentUserId === id) {
      throw new ForbiddenException(
        'Tu ne peux pas supprimer ton propre compte.',
      );
    }
    await this.usersService.deleteStaffMember(id, currentUserId);
    return { message: 'Utilisateur supprimé avec succès.' };
  }
}
