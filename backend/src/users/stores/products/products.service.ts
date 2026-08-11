import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { MovementType, PaymentMethod, UserRole } from '@prisma/client';
import { NotificationsService } from '../../../notifications/notifications.service';
import { AuditLogService } from '../../../audit-log/audit-log.service';

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  CREATION: 'Création',
  SALE: 'Vente',
  RECHARGE: 'Réapprovisionnement',
  ADJUSTMENT: 'Ajustement',
};

export enum StockAlertLevel {
  NORMAL = 'NORMAL',
  WARNING = 'WARNING',         // <= minimumStock (Recommandation de commande)
  CRITICAL = 'CRITICAL',       // <= safetyStock (Urgence absolue)
  OUT_OF_STOCK = 'OUT_OF_STOCK', // Stock épuisé (0)
}

export interface RestockSuggestion {
  id: number;
  name: string;
  sku: string | null;
  unitPrice: number;
  currentStock: number;
  minimumStock: number;
  safetyStock: number;
  optimalStock: number;
  status: StockAlertLevel;
  suggestedQuantityToOrder: number;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Évalue le niveau d'alerte statut d'un produit selon ses seuils
   */
  checkStockStatus(product: {
    quantity: number;
    minimumStock: number;
    safetyStock: number;
  }): StockAlertLevel {
    if (product.quantity <= 0) {
      return StockAlertLevel.OUT_OF_STOCK;
    }
    if (product.quantity <= product.safetyStock) {
      return StockAlertLevel.CRITICAL;
    }
    if (product.quantity <= product.minimumStock) {
      return StockAlertLevel.WARNING;
    }
    return StockAlertLevel.NORMAL;
  }

  /**
   * Calcule la quantité idéale à commander (optimalStock - currentStock)
   */
  calculateRestockQuantity(product: {
    quantity: number;
    minimumStock: number;
    optimalStock?: number | null;
  }): number {
    const target = product.optimalStock ?? product.minimumStock * 3;
    const qtyToOrder = target - product.quantity;
    return Math.max(0, qtyToOrder);
  }

  /**
   * Récupère la liste structurée des produits nécessitant un réapprovisionnement pour un magasin donné
   */
  async findLowStockProductsByStore(storeId: number): Promise<RestockSuggestion[]> {
    const storeExists = await this.prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!storeExists) {
      throw new NotFoundException(`Le magasin avec l'ID ${storeId} n'existe pas.`);
    }

    const products = await this.prisma.product.findMany({
      where: {
        storeId,
        deletedAt: null,
      },
      include: {
        category: { select: { name: true } },
        supplier: { select: { name: true, phone: true, email: true } },
      },
      orderBy: { quantity: 'asc' },
    });

    const lowStockItems: RestockSuggestion[] = [];

    for (const product of products) {
      const status = this.checkStockStatus(product);

      if (status !== StockAlertLevel.NORMAL) {
        const optimalStock = product.optimalStock ?? product.minimumStock * 3;
        const suggestedQuantityToOrder = this.calculateRestockQuantity(product);

        lowStockItems.push({
          id: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: Number(product.sellingPrice),
          currentStock: product.quantity,
          minimumStock: product.minimumStock,
          safetyStock: product.safetyStock,
          optimalStock,
          status,
          suggestedQuantityToOrder,
        });
      }
    }

    const priorityOrder = {
      [StockAlertLevel.OUT_OF_STOCK]: 1,
      [StockAlertLevel.CRITICAL]: 2,
      [StockAlertLevel.WARNING]: 3,
      [StockAlertLevel.NORMAL]: 4,
    };

    return lowStockItems.sort(
      (a, b) => priorityOrder[a.status] - priorityOrder[b.status],
    );
  }

  async createProduct(dto: CreateProductDto & { safetyStock?: number; optimalStock?: number }, userId: number) {
    const storeExists = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
    });
    if (!storeExists) throw new NotFoundException('Magasin introuvable.');

    if (dto.categoryId) {
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!categoryExists) throw new NotFoundException('Catégorie introuvable.');
    }

    if (dto.supplierId) {
      const supplierExists = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplierExists) throw new NotFoundException('Fournisseur introuvable.');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          name: dto.name,
          sku: dto.sku,
          quantity: dto.quantity,
          initialStock: dto.quantity,
          purchasePrice: dto.price,
          sellingPrice: dto.price,
          description: dto.description,
          storeId: dto.storeId,
          minimumStock: dto.minimumStock ?? 5,
          safetyStock: dto.safetyStock ?? 2,
          optimalStock: dto.optimalStock ?? null,
          categoryId: dto.categoryId,
          supplierId: dto.supplierId,
        },
      });

      if (dto.quantity > 0) {
        await tx.stockMovement.create({
          data: {
            quantity: dto.quantity,
            type: MovementType.CREATION,
            productId: product.id,
            storeId: product.storeId,
            userId,
            note: 'Stock initial à la création du produit',
          },
        });
      }

      await this.auditLogService.log(
        userId,
        `a créé le produit "${product.name}"`,
        'Product',
        product.id,
        tx,
      );

      return product;
    });
  }

  async updateProduct(id: number, dto: UpdateProductDto & { safetyStock?: number; optimalStock?: number }, userId: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

    if (dto.storeId && dto.storeId !== product.storeId) {
      const storeExists = await this.prisma.store.findUnique({
        where: { id: dto.storeId },
      });
      if (!storeExists) throw new NotFoundException('Le nouveau magasin spécifié est introuvable.');
    }

    if (dto.categoryId) {
      const categoryExists = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!categoryExists) throw new NotFoundException('Catégorie introuvable.');
    }

    if (dto.supplierId) {
      const supplierExists = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplierExists) throw new NotFoundException('Fournisseur introuvable.');
    }

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        sku: dto.sku,
        purchasePrice: dto.price !== undefined ? dto.price : undefined,
        sellingPrice: dto.price !== undefined ? dto.price : undefined,
        description: dto.description,
        storeId: dto.storeId !== undefined ? dto.storeId : undefined,
        minimumStock: dto.minimumStock !== undefined ? dto.minimumStock : undefined,
        safetyStock: dto.safetyStock !== undefined ? dto.safetyStock : undefined,
        optimalStock: dto.optimalStock !== undefined ? dto.optimalStock : undefined,
        categoryId: dto.categoryId !== undefined ? dto.categoryId : undefined,
        supplierId: dto.supplierId !== undefined ? dto.supplierId : undefined,
      },
    });

    await this.auditLogService.log(
      userId,
      `a modifié le produit "${updatedProduct.name}"`,
      'Product',
      id,
    );

    return updatedProduct;
  }

  async findLowStock(userId: number, storeId?: number) {
    const products = await this.prisma.product.findMany({
      where: {
        deletedAt: null,
        store: storeId
          ? { id: storeId }
          : { userId },
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
        store: storeId
          ? { id: storeId }
          : { userId },
      },
      include: { store: { select: { name: true, currency: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findAllByStore(storeId: number) {
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
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable.');

    await this.prisma.product.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    await this.auditLogService.log(
      userId,
      `a supprimé le produit "${product.name}"`,
      'Product',
      id,
    );

    return { message: 'Produit archivé avec succès.' };
  }

  async sellProduct(id: number, quantityToSell: number, user: any) {
    if (quantityToSell <= 0) {
      throw new BadRequestException('La quantité vendue doit être supérieure à 0.');
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

      if (user.role !== UserRole.ADMIN && user.assignedStoreId !== product.storeId) {
        throw new ForbiddenException(
          "Vous ne pouvez effectuer de vente que dans votre magasin assigné.",
        );
      }

      if (product.quantity < quantityToSell) {
        throw new BadRequestException(
          `Stock insuffisant. Unités disponibles : ${product.quantity}`,
        );
      }

      const totalAmount = product.sellingPrice * quantityToSell;

      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          quantity: product.quantity - quantityToSell,
        },
      });

      await tx.stockMovement.create({
        data: {
          quantity: -quantityToSell,
          type: MovementType.SALE,
          productId: product.id,
          storeId: product.storeId,
          userId: user.id,
          note: 'Vente produit',
        },
      });

      const invoiceNumber = `FAC-${Date.now()}`;

      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          totalAmount,
          paymentMethod: PaymentMethod.CASH,
          storeId: product.storeId,
          userId: user.id,
          items: {
            create: [
              {
                productId: product.id,
                quantity: quantityToSell,
                unitPrice: product.sellingPrice,
                total: totalAmount,
              },
            ],
          },
        },
        include: {
          items: { include: { product: true } },
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
        user.id,
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
          type: MovementType.RECHARGE,
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

  async adjustProduct(id: number, delta: number, userId: number, note?: string) {
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
          type: MovementType.ADJUSTMENT,
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
    const where = role === UserRole.CASHIER ? { storeId, userId } : { storeId };

    return this.prisma.sale.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
        items: {
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
      include: { product: true, user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProductDetails(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        store: {
          select: { name: true, currency: true },
        },
      },
    });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');

    const salesItemAgg = await this.prisma.saleItem.aggregate({
      where: { productId: id },
      _sum: { quantity: true },
    });

    const salesCount = await this.prisma.saleItem.count({
      where: { productId: id },
    });

    const rechargesAgg = await this.prisma.stockMovement.aggregate({
      where: { productId: id, type: MovementType.RECHARGE },
      _sum: { quantity: true },
      _count: true,
      _max: { createdAt: true },
    });

    const movements = await this.prisma.stockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
      select: { type: true, quantity: true, createdAt: true, note: true },
    });

    const lastSaleItem = await this.prisma.saleItem.findFirst({
      where: { productId: id },
      orderBy: { sale: { createdAt: 'desc' } },
      select: { sale: { select: { createdAt: true } } },
    });

    return {
      general: {
        name: product.name,
        sku: product.sku,
        description: product.description,
        price: product.sellingPrice,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      },

      stock: {
        currentStock: product.quantity,
        initialStock: product.initialStock,
        minimumStock: product.minimumStock,
        safetyStock: product.safetyStock,
        optimalStock: product.optimalStock ?? product.minimumStock * 3,
        stockValue: product.quantity * product.sellingPrice,
        status: this.checkStockStatus(product),
      },

      stats: {
        totalSold: salesItemAgg._sum.quantity ?? 0,
        salesCount: salesCount,
        totalRecharged: rechargesAgg._sum.quantity ?? 0,
        rechargesCount: rechargesAgg._count,
        lastSaleDate: lastSaleItem?.sale?.createdAt ?? null,
        lastRechargeDate: rechargesAgg._max.createdAt,
      },

      history: movements.map((m) => ({
        type: m.type,
        typeLabel: MOVEMENT_TYPE_LABELS[m.type],
        quantity: m.quantity,
        date: m.createdAt,
        note: m.note,
      })),

      store: {
        name: product.store.name,
        currency: product.store.currency,
      },
    };
  }

  async findAllByUser(user: { id: number; role: UserRole; assignedStoreId?: number | null }) {
    if (user.role === UserRole.ADMIN) {
      return this.prisma.product.findMany({
        where: {
          deletedAt: null,
          store: { userId: user.id },
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

    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        assignedStoreId: true,
        storeAssignments: {
          select: {
            storeId: true,
          },
        },
      },
    });

    const storeIds = [
      currentUser?.assignedStoreId,
      ...(currentUser?.storeAssignments.map((assignment) => assignment.storeId) ?? []),
    ].filter(Boolean) as number[];

    const uniqueStoreIds = Array.from(new Set(storeIds));
    if (uniqueStoreIds.length === 0) {
      return [];
    }

    return this.prisma.product.findMany({
      where: {
        deletedAt: null,
        storeId: { in: uniqueStoreIds },
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