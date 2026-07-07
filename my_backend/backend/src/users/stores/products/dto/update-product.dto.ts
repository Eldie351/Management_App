import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

// ⚠️ Volontairement pas de champ `quantity` ici : la quantité en stock ne se
// modifie jamais par un PATCH générique, uniquement via /recharge, /stock
// (vente) ou /adjust, pour que chaque variation génère un StockMovement.
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

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  storeId?: number;
}