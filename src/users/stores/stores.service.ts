import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Currency, UserRole } from '@prisma/client'; // Importation de UserRole

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Trouver un magasin par son ID
   */
  async findOne(id: number) {
    const store = await this.prisma.store.findUnique({
      where: { id },
    });

    if (!store) {
      throw new NotFoundException(`Magasin avec l'ID #${id} introuvable.`);
    }

    return store;
  }

  /**
   * Créer un nouveau magasin
   */
  async createStore(
    userId: number,
    name: string,
    location: string,
    phone: string,
    currency?: Currency,
  ) {
    return this.prisma.store.create({
      data: {
        name,
        location,
        phone,
        currency: currency || Currency.USD,
        userId,
      },
    });
  }

  /**
   * Récupérer tous les magasins accessibles à un utilisateur (ADMIN ou employé)
   */
  /**
   * Récupérer tous les magasins accessibles à un utilisateur (ADMIN ou employé)
   */
  async findAllByUser(userOrId: any) {
    // 1. Extraire l'ID peu importe le format passé (Number, Objet JWT user.id, user.userId ou user.sub)
    let userId: number | undefined;

    if (typeof userOrId === 'number') {
      userId = userOrId;
    } else if (typeof userOrId === 'string' && !isNaN(Number(userOrId))) {
      userId = Number(userOrId);
    } else if (userOrId && typeof userOrId === 'object') {
      userId = Number(userOrId.id || userOrId.userId || userOrId.sub);
    }

    if (!userId || isNaN(userId)) {
      throw new BadRequestException('Identifiant utilisateur invalide.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        assignedStoreId: true,
        storeAssignments: {
          select: {
            storeId: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // 2. Si c'est un ADMIN, on retourne les magasins qu'il possède
    if (user.role === UserRole.ADMIN) {
      return this.prisma.store.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 3. Pour les autres rôles (MANAGER, CASHIER), on combine le magasin principal et les affectations secondaires
    const storeIds = [
      user.assignedStoreId,
      ...(user.storeAssignments?.map((assignment) => assignment.storeId) ?? []),
    ].filter((id): id is number => Boolean(id));

    const uniqueStoreIds = Array.from(new Set(storeIds));

    if (uniqueStoreIds.length === 0) {
      return [];
    }

    return this.prisma.store.findMany({
      where: {
        id: { in: uniqueStoreIds },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  /**
   * Mettre à jour un magasin
   */
  async updateStore(
    id: number,
    data: { name?: string; location?: string; phone?: string; currency?: Currency },
  ) {
    await this.findOne(id);
    return this.prisma.store.update({
      where: { id },
      data,
    });
  }

  /**
   * Supprimer un magasin
   */
  async deleteStore(id: number) {
    await this.findOne(id);
    return this.prisma.store.delete({
      where: { id },
    });
  }

  /**
   * Récupérer les statistiques complètes d'un magasin
   */
  async getStoreStats(storeId: number) {
    await this.findOne(storeId);

    // 1. Agrégation des ventes (Global)
    const salesAggregate = await this.prisma.sale.aggregate({
      where: { storeId },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });

    const totalSalesCount = salesAggregate._count._all;
    const totalRevenue = Number(salesAggregate._sum.totalAmount) || 0;
    const averageBasket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

    // 2. Récupération optimisée des produits pour le calcul de l'inventaire
    const products = await this.prisma.product.findMany({
      where: { storeId },
      select: {
        quantity: true,
        minimumStock: true,
        safetyStock: true,
        sellingPrice: true,
        optimalStock: true,
      },
    });

    const totalProducts = products.length;
    let totalStockValue = 0;
    let outOfStockCount = 0;
    let criticalStockCount = 0;
    let warningStockCount = 0;
    let normalStockCount = 0;
    let productsToRestockCount = 0;
    let totalUnitsToOrder = 0;

    // 3. Calculs dynamiques en parcourant les produits
    for (const product of products) {
      const qty = product.quantity;
      const minStock = product.minimumStock ?? 0;
      const explicitSafetyStock = product.safetyStock;
      
      const safetyStock =
        explicitSafetyStock !== null && explicitSafetyStock !== undefined
          ? explicitSafetyStock
          : Math.floor(minStock / 2);
          
      const optimalStock = product.optimalStock ?? minStock * 2; 

      totalStockValue += qty > 0 ? (qty * Number(product.sellingPrice)) : 0;

      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= safetyStock) {
        criticalStockCount++;
      } else if (qty <= minStock) {
        warningStockCount++;
      } else {
        normalStockCount++;
      }

      if (qty <= minStock) {
        productsToRestockCount++;
        const unitsNeeded = optimalStock - qty;
        if (unitsNeeded > 0) {
          totalUnitsToOrder += unitsNeeded;
        }
      }
    }

    const stockoutRate = totalProducts > 0 ? (outOfStockCount / totalProducts) * 100 : 0;

    return {
      storeId,
      inventory: {
        totalProducts,
        totalStockValue,
        outOfStockCount,
        criticalStockCount,
        warningStockCount,
        normalStockCount,
        stockoutRate: Number(stockoutRate.toFixed(2)),
      },
      restockSummary: {
        productsToRestockCount,
        totalUnitsToOrder,
      },
      salesSummary: {
        totalRevenue,
        totalSalesCount,
        averageBasket: Number(averageBasket.toFixed(2)),
      },
    };
  }

  async getSalesForPeriod(storeId: number, period: string, index: number = 1) {
    await this.findOne(storeId);

    const { startDate, endDate } = this.getDateRangeForPeriod(period);

    const limit = 20;
    const page = Math.max(1, index);
    const skip = (page - 1) * limit;

    const salesAggregate = await this.prisma.sale.aggregate({
      where: {
        storeId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: { totalAmount: true },
    });

    const salesList = await this.prisma.sale.findMany({
      where: {
        storeId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const totalSalesCount = await this.prisma.sale.count({
      where: {
        storeId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    return {
      periodInfo: {
        requestedPeriod: period,
        startDate,
        endDate,
      },
      summary: {
        totalRevenue: Number(salesAggregate._sum.totalAmount) || 0,
        totalSales: totalSalesCount,
      },
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalSalesCount / limit),
        hasNextPage: page * limit < totalSalesCount,
      },
      data: salesList,
    };
  }

  private getDateRangeForPeriod(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    switch (period.toLowerCase()) {
      case 'day':
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'week':
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;

      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(now.getFullYear(), 11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;

      default:
        throw new BadRequestException(
          `Période invalide: ${period}. Utilisez 'day', 'week', 'month' ou 'year'.`
        );
    }

    return { startDate, endDate };
  }
}