import { Currency } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du magasin est obligatoire.' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: "L'adresse du magasin est obligatoire." })
  location: string;

  @IsString()
  @IsNotEmpty({ message: 'Le téléphone du magasin est obligatoire.' })
  phone: string;

  @IsEnum(Currency, { message: 'La devise du magasin est invalide.' })
  @IsOptional()
  currency?: Currency;
}
