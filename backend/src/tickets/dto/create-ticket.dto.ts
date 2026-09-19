import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateTicketDto {
  @IsInt()
  @IsNotEmpty({ message: 'Le ticket doit être rattaché à un magasin.' })
  storeId: number;

  @IsInt()
  @IsNotEmpty({ message: 'Le ticket doit concerner un produit.' })
  productId: number;

  @IsInt()
  @IsNotEmpty({ message: 'Veuillez choisir un destinataire pour ce ticket.' })
  recipientId: number;

  @IsString()
  @IsNotEmpty({ message: 'Une justification est obligatoire.' })
  justification: string;

  @IsInt()
  @Min(1, { message: 'La quantité demandée doit être au moins égale à 1.' })
  @IsOptional()
  requestedQuantity?: number;
}
