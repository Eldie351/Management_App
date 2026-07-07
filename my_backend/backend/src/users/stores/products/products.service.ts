import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(dto: CreateProductDto, userId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    const storeExists = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!storeExists) throw new NotFoundException('Magasin introuvable.');

    // La création du produit et le mouvement de stock CREATION associé
    // doivent réussir ensemble ou pas du tout.
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          sku: dto.sku,
          quantity: dto.quantity,
          initialStock: dto.quantity, // 👈 figé définitivement à la création
          purchasePrice: dto.price,
          sellingPrice: dto.price,
          description: dto.description,
          storeId: dto.storeId,
        },
      });

      if (dto.quantity > 0) {
        await tx.stockMovement.create({
          data: {
            quantity: dto.quantity,
            type: 'CREATION',
            productId: product.id,
            storeId: product.storeId,
            userId,
            note: 'Stock initial à la création du produit',
          },
        });
      }

      return product;
    });
  }

  /**
   * MODIFIER UN PRODUIT ENREGISTRÉ
   */
  async updateProduct(id: number, dto: UpdateProductDto) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    // 1. Vérifier si le produit existe (et n'est pas archivé)
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

    // 2. Si le storeId change, vérifier que le nouveau magasin existe
    if (dto.storeId && dto.storeId !== product.storeId) {
      const storeExists = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
      if (!storeExists) throw new NotFoundException('Le nouveau magasin spécifié est introuvable.');
    }

    // 3. Appliquer la mise à jour sélective
    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        sku: dto.sku,
        // ⚠️ La quantité ne se modifie plus ici : elle doit toujours passer
        // par /recharge, /stock (vente) ou /adjust pour garder un historique
        // de StockMovement cohérent avec le stock réel.
        purchasePrice: dto.price !== undefined ? dto.price : undefined, 
        sellingPrice: dto.price !== undefined ? dto.price : undefined,  
        description: dto.description,
        storeId: dto.storeId !== undefined ? dto.storeId : undefined, // 👈 CORRIGÉ : Protège contre les crashs si storeId n'est pas fourni !
      },
    });
  }
  
  async findAllByStore(storeId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');
    
    return this.prisma.product.findMany({
      where: {
        storeId,
        deletedAt: null,
      },
      include: {
        store: {
          select: {
            currency: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async deleteProduct(id: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');

    await this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return { message: 'Produit archivé avec succès.' };
  }

  async sellProduct(id: number, quantityToSell: number, userId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    if (quantityToSell <= 0) {
      throw new BadRequestException('La quantité vendue doit être supérieure à 0.');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

      if (product.quantity < quantityToSell) {
        throw new BadRequestException(
          `Stock insuffisant. Unités disponibles : ${product.quantity}`,
        );
      }

      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          quantity: product.quantity - quantityToSell,
        },
      });

      await tx.stockMovement.create({
        data: {
          quantity: quantityToSell,
          type: 'SALE',
          productId: product.id,
          storeId: product.storeId,
          userId,
          note: 'Vente produit',
        },
      });

      const sale = await tx.sale.create({
        data: {
          unitPrice: product.sellingPrice,
          quantity: quantityToSell,
          total: product.sellingPrice * quantityToSell,
          productId: product.id,
          storeId: product.storeId,
          userId,
        },
      });

      return {
        product: updatedProduct,
        sale,
      };
    });
  }

  async rechargeProduct(id: number, quantityToAdd: number, userId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    if (quantityToAdd <= 0) {
      throw new BadRequestException('La quantité rechargée doit être supérieure à 0.');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          quantity: product.quantity + quantityToAdd,
        },
      });

      await tx.stockMovement.create({
        data: {
          quantity: quantityToAdd,
          type: 'RECHARGE',
          productId: product.id,
          storeId: product.storeId,
          userId,
          note: 'Réapprovisionnement',
        },
      });

      return updatedProduct;
    });
  }

  /**
   * Correction manuelle du stock (inventaire, casse, erreur de saisie...).
   * delta peut être positif (+5) ou négatif (-5).
   */
  async adjustProduct(id: number, delta: number, userId: number, note?: string) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    if (delta === 0) {
      throw new BadRequestException('La correction ne peut pas être nulle.');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

      const newQuantity = product.quantity + delta;
      if (newQuantity < 0) {
        throw new BadRequestException(
          `Cette correction ferait passer le stock en négatif (actuel : ${product.quantity}).`,
        );
      }

      const updatedProduct = await tx.product.update({
        where: { id },
        data: { quantity: newQuantity },
      });

      await tx.stockMovement.create({
        data: {
          quantity: delta,
          type: 'ADJUSTMENT',
          productId: product.id,
          storeId: product.storeId,
          userId,
          note: note ?? 'Correction manuelle de stock',
        },
      });

      return updatedProduct;
    });
  }

  async findSalesByStore(storeId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    return this.prisma.sale.findMany({
      where: { storeId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            sellingPrice: true, 
            purchasePrice: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getStockMovements(storeId: number) {
    return this.prisma.stockMovement.findMany({
      where: { storeId },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * GET /products/:id/details
   * Fiche complète d'un produit : infos, statistiques et historique.
   */
  async getProductDetails(id: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

    const [salesAgg, rechargesAgg, movements] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { productId: id },
        _sum: { quantity: true },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.stockMovement.aggregate({
        where: { productId: id, type: 'RECHARGE' },
        _sum: { quantity: true },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.stockMovement.findMany({
        where: { productId: id },
        orderBy: { createdAt: 'desc' },
        select: { type: true, quantity: true, createdAt: true, note: true },
      }),
    ]);

    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.sellingPrice,
        initialStock: product.initialStock,
        currentStock: product.quantity,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },
      stats: {
        totalSold: salesAgg._sum.quantity ?? 0,
        salesCount: salesAgg._count._all,
        totalRecharged: rechargesAgg._sum.quantity ?? 0,
        rechargesCount: rechargesAgg._count._all,
        lastSaleDate: salesAgg._max.createdAt,
        lastRechargeDate: rechargesAgg._max.createdAt,
        stockValue: product.quantity * product.sellingPrice,
      },
      history: movements.map((m) => ({
        type: m.type,
        quantity: m.quantity,
        note: m.note,
        date: m.createdAt,
      })),
    };
  }

  async findAllByUserId(userId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        store: { userId },
      },
      include: {
        store: {
          select: {
            name: true,
            currency: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}