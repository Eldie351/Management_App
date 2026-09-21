import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class UpdateUserStoresDto {
  @IsArray({ message: 'La liste des magasins doit être un tableau.' })
  @ArrayNotEmpty({ message: 'Le personnel doit être assigné à au moins un magasin.' })
  @IsInt({ each: true, message: 'Chaque magasin doit être un ID valide.' })
  storeIds: number[];
}
