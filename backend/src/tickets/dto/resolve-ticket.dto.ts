import { IsOptional, IsString } from 'class-validator';

export class ResolveTicketDto {
  @IsString()
  @IsOptional()
  resolutionNote?: string;
}
