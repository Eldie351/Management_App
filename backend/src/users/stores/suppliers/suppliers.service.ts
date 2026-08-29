import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { assertStoreAccess, getAllowedStoreIds } from '../../../common/utils/store-access.util';

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
   *
   * BUGFIX : la version précédente filtrait uniquement `store: { userId }`
   * (magasins POSSÉDÉS). Un MANAGER ne possède jamais de magasin — il y est
   * seulement affecté — donc cet endpoint lui renvoyait toujours une liste
   * vide, même avec des fournisseurs existants dans son magasin. On utilise
   * maintenant la même notion d'accès (possédé OU affecté) que partout ailleurs.
   */
  async findAllByUser(user: any) {
    const allowedStoreIds = getAllowedStoreIds(user);
    if (allowedStoreIds.length === 0) {
      return [];
    }

    return this.prisma.supplier.findMany({
      where: { storeId: { in: allowedStoreIds } },
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

  async update(id: number, dto: UpdateSupplierDto, user: any) {
    const supplier = await this.findOne(id);
    // BUGFIX : aucune vérification n'existait — n'importe quel ADMIN/MANAGER
    // pouvait modifier le fournisseur d'un autre commerce.
    assertStoreAccess(user, supplier.storeId, "Vous n'avez pas accès à ce fournisseur.");

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

  async remove(id: number, user: any) {
    const supplier = await this.findOne(id);
    assertStoreAccess(user, supplier.storeId, "Vous n'avez pas accès à ce fournisseur.");

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
