import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Ajustez le chemin
import { Currency } from '@prisma/client';

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
   * Récupérer tous les magasins appartenant à un utilisateur ADMIN
   */
  async findAllByUser(userId: number) {
    return this.prisma.store.findMany({
      where: { userId },
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
      
      // Fallback: si pas de safetyStock défini, on utilise la moitié du minimumStock
      const safetyStock =
        explicitSafetyStock !== null && explicitSafetyStock !== undefined
          ? explicitSafetyStock
          : Math.floor(minStock / 2);
          
      // Fallback: si pas de optimalStock défini, on vise le double du minimumStock
      const optimalStock = product.optimalStock ?? minStock * 2; 

      // -- Valeur du stock
      totalStockValue += qty > 0 ? (qty * Number(product.sellingPrice)) : 0;

      // -- Ventilation des statuts
      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= safetyStock) {
        criticalStockCount++;
      } else if (qty <= minStock) {
        warningStockCount++;
      } else {
        normalStockCount++;
      }

      // -- Synthèse des besoins en réapprovisionnement (Seulement si sous le minStock)
      if (qty <= minStock) {
        productsToRestockCount++;
        const unitsNeeded = optimalStock - qty;
        if (unitsNeeded > 0) {
          totalUnitsToOrder += unitsNeeded;
        }
      }
    }

    const stockoutRate = totalProducts > 0 ? (outOfStockCount / totalProducts) * 100 : 0;

    // 4. Construction de l'objet de réponse
    return {
      storeId,
      inventory: {
        totalProducts,
        totalStockValue,
        outOfStockCount,
        criticalStockCount,
        warningStockCount,
        normalStockCount,
        stockoutRate: Number(stockoutRate.toFixed(2)), // Arrondi à 2 décimales
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
    await this.findOne(storeId); // Vérifie que le magasin existe

    // 1. Détermination de la plage de dates
    const { startDate, endDate } = this.getDateRangeForPeriod(period);

    // 2. Configuration de la pagination
    const limit = 20;
    const page = Math.max(1, index); // Sécurité : page minimum = 1
    const skip = (page - 1) * limit;

    // 3. Exécution de deux requêtes en parallèle : Agrégation (Total) + Liste des ventes
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
      include: {
        // Décommentez si vous souhaitez inclure les détails des ventes et les infos caissier
        // items: true,
        // user: { select: { id: true, firstName: true, lastName: true } }
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

    // 4. Formatage de la réponse
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

  /**
   * Helper : Calcule les dates de début et de fin selon une période donnée
   * Utilise l'objet Date natif de JavaScript (sans librairie externe)
   */
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
        // Ajuste pour que la semaine commence le lundi (si dimanche, day = 0, on recule de 6 jours)
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
        
        // Le jour '0' du mois suivant correspond au dernier jour du mois actuel
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