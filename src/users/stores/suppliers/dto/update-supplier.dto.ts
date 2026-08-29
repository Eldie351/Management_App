import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateSupplierDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail({}, { message: "L'email fourni n'est pas valide." })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  address?: string;
}
