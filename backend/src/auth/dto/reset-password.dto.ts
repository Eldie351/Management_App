import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  // BUGFIX (intégrité des comptes) : n'exigeait avant que 6 caractères,
  // alors que RegisterDto impose une politique forte (8+ caractères, majuscule,
  // minuscule, chiffre, caractère spécial). Un utilisateur pouvait donc
  // contourner la politique de mot de passe simplement en passant par "mot de
  // passe oublié" juste après son inscription. On aligne les deux règles.
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_#\-]).{8,}$/, {
    message:
      'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial (@$!%*?&_#-)',
  })
  password: string;
}
