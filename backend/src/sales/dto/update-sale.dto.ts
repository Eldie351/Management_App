import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

/**
 * Champs modifiables a posteriori sur un reçu/facture déjà émis.
 *
 * Volontairement limité au nom du client et au mode de paiement : les
 * articles, quantités et montants ne sont PAS éditables ici, car ils sont
 * liés au stock déjà décrémenté et au numéro de facture déjà émis. Pour
 * corriger une erreur sur les articles/montants, la facture doit être
 * annulée (DELETE, qui restaure le stock) puis ressaisie.
 */
export class UpdateSaleDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  customerName?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'Mode de paiement invalide' })
  paymentMethod?: PaymentMethod;
}
