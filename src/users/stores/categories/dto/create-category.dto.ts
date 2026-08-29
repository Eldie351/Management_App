import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom de la catégorie est obligatoire.' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsNotEmpty({ message: 'La catégorie doit être rattachée à un magasin.' })
  storeId: number;
}
