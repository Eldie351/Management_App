import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du fournisseur est obligatoire.' })
  name: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail({}, { message: "L'email fourni n'est pas valide." })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Le fournisseur doit être rattaché à un magasin.' })
  storeId: number;
}
