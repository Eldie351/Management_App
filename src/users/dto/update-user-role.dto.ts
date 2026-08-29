import { IsEnum, IsNotEmpty } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateUserRoleDto {
  @IsEnum(UserRole, { message: 'Rôle invalide. Valeurs acceptées : ADMIN, MANAGER, CASHIER.' })
  @IsNotEmpty()
  role: UserRole;
}
