import { Type } from 'class-transformer';
import { 
  IsArray, 
  IsEnum, 
  IsInt, 
  IsNotEmpty, 
  IsNumber, 
  IsPositive, 
  ValidateNested 
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

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
}