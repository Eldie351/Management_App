import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  ValidateNested
} from 'class-validator';
import { DiscountType, PaymentMethod } from '@prisma/client';

export class SaleItemDto {
  @IsInt()
  @IsNotEmpty()
  productId: number;

  @IsInt()
  @IsPositive({ message: 'La quantité doit être supérieure à 0' })
  quantity: number;

  @IsNumber()
  @IsPositive()
  unitPrice: number;
}

export class CreateSaleDto {
  @IsInt()
  @IsNotEmpty()
  storeId: number;

  @IsEnum(PaymentMethod, { message: 'Mode de paiement invalide' })
  paymentMethod: PaymentMethod;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @IsOptional()
  @IsEnum(DiscountType, { message: 'Type de remise invalide' })
  discountType?: DiscountType;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'La remise ne peut pas être négative' })
  discountValue?: number;
}