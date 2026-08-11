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
 * Gestion du personnel par l'ADMIN.
 * 
 * Permet aux Administrateurs de créer et gérer les comptes MANAGER et CASHIER.
 * Chaque employé créé est rattaché à l'Admin qui l'a créé (createdById) 
 * et peut être assigné à un magasin spécifique (assignedStoreId).
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Lister tous les utilisateurs (réservé aux ADMINs).
   */
  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  /**
   * Créer un membre du personnel (Manager ou Caissier).
   */
  @Post('staff')
  async createStaff(
    @Body() dto: CreateStaffUserDto,
    @CurrentUser('id') adminId: number,
  ) {
    return this.usersService.createStaffUser(dto, adminId);
  }

  /**
   * Lister les comptes managers et caissiers créés par l'administrateur.
   */
  @Get('staff')
  async findStaffCreatedByAdmin(@CurrentUser('id') adminId: number) {
    return this.usersService.findCreatedByAdmin(adminId);
  }

  /**
   * Modifier le rôle d'un utilisateur.
   */
  @Patch(':id/role')
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser('id') currentUserId: number,
  ) {
    if (currentUserId === id) {
      throw new ForbiddenException('Tu ne peux pas modifier ton propre rôle.');
    }
    return this.usersService.updateRole(id, dto.role);
  }

  /**
   * Supprimer un compte utilisateur.
   */
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') currentUserId: number,
  ) {
    if (currentUserId === id) {
      throw new ForbiddenException(
        'Tu ne peux pas supprimer ton propre compte.',
      );
    }
    await this.usersService.delete(id);
    return { message: 'Utilisateur supprimé avec succès.' };
  }
}