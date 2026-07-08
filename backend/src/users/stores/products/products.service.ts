import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MovementType, UserRole } from '@prisma/client';
import { NotificationsService } from '../../../notifications/notifications.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  CREATION: 'Création',
  SALE: 'Vente',
  RECHARGE: 'Réapprovisionnement',
  ADJUSTMENT: 'Ajustement',
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createProduct(dto: CreateProductDto, userId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    const storeExists = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
    if (!storeExists) throw new NotFoundException('Magasin introuvable.');

    if (dto.categoryId) {
      const categoryExists = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!categoryExists) throw new NotFoundException('Catégorie introuvable.');
    }
    if (dto.supplierId) {
      const supplierExists = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplierExists) throw new NotFoundException('Fournisseur introuvable.');
    }

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
          minimumStock: dto.minimumStock ?? 5,
          categoryId: dto.categoryId,
          supplierId: dto.supplierId,
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

      await this.auditLogService.log(userId, `a créé le produit "${product.name}"`, 'Product', product.id, tx);

      return product;
    });
  }

  /**
   * MODIFIER UN PRODUIT ENREGISTRÉ
   */
  async updateProduct(id: number, dto: UpdateProductDto, userId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    // 1. Vérifier si le produit existe (et n'est pas archivé)
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

    // 2. Si le storeId change, vérifier que le nouveau magasin existe
    if (dto.storeId && dto.storeId !== product.storeId) {
      const storeExists = await this.prisma.store.findUnique({ where: { id: dto.storeId } });
      if (!storeExists) throw new NotFoundException('Le nouveau magasin spécifié est introuvable.');
    }
    if (dto.categoryId) {
      const categoryExists = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!categoryExists) throw new NotFoundException('Catégorie introuvable.');
    }
    if (dto.supplierId) {
      const supplierExists = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplierExists) throw new NotFoundException('Fournisseur introuvable.');
    }

    // 3. Appliquer la mise à jour sélective
    const updatedProduct = await this.prisma.product.update({
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
        minimumStock: dto.minimumStock !== undefined ? dto.minimumStock : undefined,
        categoryId: dto.categoryId !== undefined ? dto.categoryId : undefined,
        supplierId: dto.supplierId !== undefined ? dto.supplierId : undefined,
      },
    });

    await this.auditLogService.log(userId, `a modifié le produit "${updatedProduct.name}"`, 'Product', id);

    return updatedProduct;
  }
  
  /**
   * GET /products/low-stock : stock > 0 mais <= minimumStock.
   * GET /products/out-of-stock : stock <= 0.
   * Scopés aux magasins de l'utilisateur connecté ; filtrable par storeId.
   */
  async findLowStock(userId: number, storeId?: number) {
    // Prisma ne permet pas de comparer deux colonnes entre elles dans un
    // `where` (quantity <= minimumStock) : on filtre donc côté application.
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        store: { userId, ...(storeId ? { id: storeId } : {}) },
      },
      include: { store: { select: { name: true, currency: true } } },
      orderBy: { quantity: 'asc' },
    });

    return products.filter((p) => p.quantity > 0 && p.quantity <= p.minimumStock);
  }

  async findOutOfStock(userId: number, storeId?: number) {
    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        quantity: { lte: 0 },
        store: { userId, ...(storeId ? { id: storeId } : {}) },
      },
      include: { store: { select: { name: true, currency: true } } },
      orderBy: { updatedAt: 'desc' },
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

  async deleteProduct(id: number, userId: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');

    await this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.auditLogService.log(userId, `a supprimé le produit "${product.name}"`, 'Product', id);

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

      await this.notificationsService.checkStockThreshold(tx, {
        storeId: product.storeId,
        productId: product.id,
        productName: product.name,
        minimumStock: product.minimumStock,
        previousQuantity: product.quantity,
        newQuantity: updatedProduct.quantity,
      });

      await this.auditLogService.log(
        userId,
        `a vendu ${quantityToSell} unité(s) de "${product.name}"`,
        'Product',
        product.id,
        tx,
      );

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

      await this.auditLogService.log(
        userId,
        `a réapprovisionné "${product.name}" de ${quantityToAdd} unité(s)`,
        'Product',
        product.id,
        tx,
      );

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

      if (delta < 0) {
        await this.notificationsService.checkStockThreshold(tx, {
          storeId: product.storeId,
          productId: product.id,
          productName: product.name,
          minimumStock: product.minimumStock,
          previousQuantity: product.quantity,
          newQuantity: updatedProduct.quantity,
        });
      }

      await this.auditLogService.log(
        userId,
        `a ajusté le stock de "${product.name}" de ${delta > 0 ? '+' : ''}${delta}`,
        'Product',
        product.id,
        tx,
      );

      return updatedProduct;
    });
  }

  async findSalesByStore(storeId: number, userId: number, role: UserRole) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    // ADMIN/MANAGER voient toutes les ventes du magasin ; CASHIER ne voit
    // que les siennes ("Voir ses ventes" dans la matrice de permissions).
    const where = role === 'CASHIER' ? { storeId, userId } : { storeId };

    return this.prisma.sale.findMany({
      where,
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
   * Fiche complète d'un produit : informations, stock, statistiques,
   * historique des mouvements et infos du magasin.
   */
  async getProductDetails(id: number) {
    if (!this.prisma) throw new InternalServerErrorException('PrismaService not available');

    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        store: {
          select: { name: true, currency: true },
        },
      },
    });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

    const [salesAgg, rechargesAgg, movements] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { productId: id },
        _sum: { quantity: true },
        _count: true,
        _max: { createdAt: true },
      }),
      this.prisma.stockMovement.aggregate({
        where: { productId: id, type: 'RECHARGE' },
        _sum: { quantity: true },
        _count: true,
        _max: { createdAt: true },
      }),
      this.prisma.stockMovement.findMany({
        where: { productId: id },
        orderBy: { createdAt: 'desc' },
        select: { type: true, quantity: true, createdAt: true, note: true },
      }),
    ]);

    return {
      // Informations générales
      general: {
        name: product.name,
        sku: product.sku,
        description: product.description,
        price: product.sellingPrice,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },

      // État du stock
      stock: {
        currentStock: product.quantity,
        initialStock: product.initialStock,
        minimumStock: product.minimumStock,
        stockValue: product.quantity * product.sellingPrice,
        status: this.getStockStatus(product.quantity, product.minimumStock),
      },

      // Statistiques
      stats: {
        totalSold: salesAgg._sum.quantity ?? 0,
        salesCount: salesAgg._count,
        totalRecharged: rechargesAgg._sum.quantity ?? 0,
        rechargesCount: rechargesAgg._count,
        lastSaleDate: salesAgg._max.createdAt,
        lastRechargeDate: rechargesAgg._max.createdAt,
      },

      // Historique des mouvements
      history: movements.map((m) => ({
        type: m.type,
        typeLabel: MOVEMENT_TYPE_LABELS[m.type],
        quantity: m.quantity,
        date: m.createdAt,
        note: m.note,
      })),

      // Informations du magasin
      store: {
        name: product.store.name,
        currency: product.store.currency,
      },
    };
  }

  /**
   * Rupture : plus aucune unité en stock.
   * Faible : stock ≤ seuil minimum défini sur le produit (minimumStock).
   * Normal : au-dessus du seuil.
   */
  private getStockStatus(quantity: number, minimumStock: number): 'Rupture' | 'Faible' | 'Normal' {
    if (quantity <= 0) return 'Rupture';
    if (quantity <= minimumStock) return 'Faible';
    return 'Normal';
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