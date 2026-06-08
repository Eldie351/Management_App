import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du magasin est obligatoire.' })
  name: string;

  @IsString()
  @IsOptional()
  location?: string;
}
