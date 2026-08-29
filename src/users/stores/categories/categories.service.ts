import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto) {
    const storeExists = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!storeExists) throw new NotFoundException('Magasin introuvable.');

    return this.prisma.category.create({
      data: {
        name: dto.name,
        description: dto.description,
        storeId: dto.storeId,
      },
    });
  }

  async findAllByStore(storeId: number) {
    return this.prisma.category.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Catégorie introuvable.');
    return category;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id); // 404 si absente

    return this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id); // 404 si absente

    // Une catégorie liée à des produits ne peut pas être supprimée : on
    // détacherait silencieusement des produits existants sinon, ce qui
    // fausserait leurs fiches. On force à réassigner les produits d'abord.
    const productsCount = await this.prisma.product.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (productsCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer cette catégorie : ${productsCount} produit(s) y sont encore rattaché(s). Réassigne-les d'abord.`,
      );
    }

    await this.prisma.category.delete({ where: { id } });
    return { message: 'Catégorie supprimée avec succès.' };
  }
}
