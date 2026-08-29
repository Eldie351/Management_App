import {
  IsArray,
  ArrayNotEmpty,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
  Matches,
  IsInt,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateStaffUserDto {
  @IsEmail({}, { message: 'L’adresse email est invalide.' })
  email: string;

  @IsString({ message: 'Le nom est requis.' })
  @IsNotEmpty({ message: 'Le nom est requis.' })
  name: string;

  // BUGFIX (intégrité des comptes) : n'exigeait avant que 6 caractères, une
  // politique plus faible que celle imposée à l'inscription (RegisterDto).
  // Un employé créé par un admin pouvait donc se voir attribuer un mot de
  // passe nettement moins robuste qu'un compte auto-inscrit.
  @IsString({ message: 'Le mot de passe est requis.' })
  @IsNotEmpty({ message: 'Le mot de passe est requis.' })
  @MinLength(8, {
    message: 'Le mot de passe doit contenir au moins 8 caractères.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#\-]).{8,}$/, {
    message:
      'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial (@$!%*?&_#-)',
  })
  password: string;

  @IsIn([UserRole.MANAGER, UserRole.CASHIER], {
    message: 'Seuls les rôles MANAGER et CASHIER sont autorisés.',
  })
  role: UserRole;

  @IsArray({ message: 'La liste des magasins doit être un tableau.' })
  @ArrayNotEmpty({ message: 'Le personnel doit être assigné à au moins un magasin.' })
  @IsInt({ each: true, message: 'Chaque magasin doit être un ID valide.' })
  storeIds: number[];
}
