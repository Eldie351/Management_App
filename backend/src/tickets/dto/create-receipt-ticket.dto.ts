import { Transform } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateReceiptTicketDto {
  @IsInt()
  @IsNotEmpty({ message: 'Le ticket doit concerner un reçu.' })
  saleId: number;

  @IsInt()
  @IsNotEmpty({ message: 'Veuillez choisir un destinataire pour ce ticket.' })
  recipientId: number;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Une justification est obligatoire.' })
  @MaxLength(1000)
  justification: string;
}
