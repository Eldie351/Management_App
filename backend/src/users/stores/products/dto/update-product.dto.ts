import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsNumber({}, { message: 'Le prix doit être un nombre.' })
  @Min(0, { message: 'Le prix ne peut pas être négatif.' })
  @IsOptional()
  price?: number;

  @IsNumber({}, { message: 'La quantité doit être un nombre.' })
  @Min(0, { message: 'La quantité ne peut pas être négative.' })
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  storeId?: number;

  @IsNumber()
  @Min(0, { message: 'Le stock minimum ne peut pas être négatif.' })
  @IsOptional()
  minimumStock?: number;

  @IsNumber()
  @Min(0, { message: 'Le stock de sécurité ne peut pas être négatif.' })
  @IsOptional()
  safetyStock?: number;

  @IsNumber()
  @Min(1, { message: 'Le stock optimal doit être au moins égal à 1.' })
  @IsOptional()
  optimalStock?: number;

  @IsNumber()
  @IsOptional()
  categoryId?: number;

  @IsNumber()
  @IsOptional()
  supplierId?: number;
}