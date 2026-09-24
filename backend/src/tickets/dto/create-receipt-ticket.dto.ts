import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ReceiptActionType } from '@prisma/client';

export class CreateReceiptTicketDto {
  @IsInt()
  @IsNotEmpty({ message: 'Le ticket doit concerner un reçu.' })
  saleId: number;

  // Action demandée à l'ADMIN : le ticket est validé quand il l'effectue.
  @IsEnum(ReceiptActionType, { message: 'Veuillez indiquer si le reçu doit être modifié ou supprimé.' })
  requestedAction: ReceiptActionType;

  @IsInt()
  @IsNotEmpty({ message: 'Veuillez choisir un destinataire pour ce ticket.' })
  recipientId: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Une justification est obligatoire.' })
  @MaxLength(1000)
  justification: string;
}
