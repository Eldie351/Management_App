import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DiscountType, PaymentMethod } from '@prisma/client';

export class UpdateSaleItemDto {
  @IsInt()
  @IsNotEmpty()
  productId: number;

  @IsInt()
  @IsPositive({ message: 'La quantité doit être supérieure à 0' })
  quantity: number;

  @IsNumber()
  @Min(0, { message: 'Le prix unitaire ne peut pas être négatif' })
  unitPrice: number;
}

/**
 * Modification complète a posteriori d'un reçu/facture déjà émis (ADMIN).
 *
 * Tous les champs sont optionnels sauf `reason` : un champ absent garde sa
 * valeur actuelle. Si `items` est fourni, il REMPLACE entièrement la liste
 * des articles ; le stock est alors ajusté de la différence (voir
 * SalesService.updateSale). Le numéro de facture et la date ne changent pas.
 */
export class UpdateSaleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Le motif de la modification est obligatoire.' })
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Mode de paiement invalide' })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: 'Un reçu doit contenir au moins un article.' })
  @ValidateNested({ each: true })
  @Type(() => UpdateSaleItemDto)
  items?: UpdateSaleItemDto[];

  // `null` retire la remise, `undefined` garde la remise actuelle.
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsEnum(DiscountType, { message: 'Type de remise invalide' })
  discountType?: DiscountType | null;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'La remise ne peut pas être négative' })
  discountValue?: number;
}
