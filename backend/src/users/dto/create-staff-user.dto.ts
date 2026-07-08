import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateStaffUserDto {
  @IsEmail({}, { message: 'L’adresse email est invalide.' })
  email: string;

  @IsString({ message: 'Le nom est requis.' })
  @IsNotEmpty({ message: 'Le nom est requis.' })
  name: string;

  @IsString({ message: 'Le mot de passe est requis.' })
  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @MinLength(6, {
    message: 'Le mot de passe doit contenir au moins 6 caractères.',
  })
  password: string;

  @IsIn([UserRole.MANAGER, UserRole.CASHIER], {
    message: 'Seuls les rôles MANAGER et CASHIER sont autorisés.',
  })
  role: UserRole;
}
