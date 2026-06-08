import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du produit est obligatoire.' })
  name: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsNumber()
  @Min(0, { message: 'La quantité ne peut pas être négative.' })
  quantity: number;

  @IsNumber({}, { message: 'Le prix doit être un nombre.' })
  @Min(0, { message: 'Le prix ne peut pas être négative.' })
  price: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty({ message: 'Le produit doit être rattaché à un magasin.' })
  storeId: number;
}
