import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierDto) {
    const storeExists = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!storeExists) throw new NotFoundException('Magasin introuvable.');

    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
        storeId: dto.storeId,
      },
    });
  }

  /**
   * GET /suppliers : scopé aux magasins de l'utilisateur connecté.
   * (Un simple `findMany()` sans filtre exposerait les fournisseurs de
   * TOUS les utilisateurs, ce qui serait une fuite de données.)
   */
  async findAllByUser(userId: number) {
    return this.prisma.supplier.findMany({
      where: { store: { userId } },
      orderBy: { name: 'asc' },
    });
  }

  async findAllByStore(storeId: number) {
    return this.prisma.supplier.findMany({
      where: { storeId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException('Fournisseur introuvable.');
    return supplier;
  }

  async update(id: number, dto: UpdateSupplierDto) {
    await this.findOne(id);

    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email,
        address: dto.address,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    const productsCount = await this.prisma.product.count({
      where: { supplierId: id, deletedAt: null },
    });
    if (productsCount > 0) {
      throw new ConflictException(
        `Impossible de supprimer ce fournisseur : ${productsCount} produit(s) y sont encore rattaché(s). Réassigne-les d'abord.`,
      );
    }

    await this.prisma.supplier.delete({ where: { id } });
    return { message: 'Fournisseur supprimé avec succès.' };
  }
}
