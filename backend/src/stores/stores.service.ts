import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. CRÉER UN MAGASIN (ENTREPÔT)
   */
  async createStore(userId: number, name: string, location?: string) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const userExists = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      throw new NotFoundException("Impossible de créer le magasin : Utilisateur introuvable.");
    }

    return this.prisma.store.create({
      data: {
        name,
        location,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * 2. RÉCUPÉRER TOUS LES MAGASINS D'UN UTILISATEUR
   */
  async findAllByUser(userId: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    return this.prisma.store.findMany({
      where: { userId },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });
  }

  /**
   * 3. SUPPRIMER UN MAGASIN
   */
  async deleteStore(storeId: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Magasin introuvable.');

    await this.prisma.store.delete({ where: { id: storeId } });
    return { message: 'Magasin et tous ses produits supprimés avec succès.' };
  }

  /**
   * 4. CALCULER LES STATISTIQUES RÉELLES BASÉES SUR LES VENTES
   */
 
    /**
   * 4. CALCULER LES STATISTIQUES RÉELLES ET ROBUSTES BASÉES SUR LES VENTES
   */
  async getStoreStats(storeId: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { 
        products: true,
        sales: true, // Récupère l'historique complet de PostgreSQL
      },
    });

    if (!store) throw new NotFoundException('Magasin introuvable.');

    // Calculs de base
    const currentProductsVolume = store.products.reduce((acc, p) => acc + p.quantity, 0);
    const currentStockValue = store.products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const totalSalesRevenue = store.sales.reduce((acc, s) => acc + s.total, 0);
    const totalUnitsSold = store.sales.reduce((acc, s) => acc + s.quantity, 0);

    const dailyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();
    const yearlyMap = new Map<string, number>();

    // Tableau des jours pour s'assurer d'une clé propre en français
    const jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const mois = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    store.sales.forEach((sale) => {
      const date = new Date(sale.createdAt);
      
      // 1. Clé Jour propre (ex: "Lun", "Mar")
      const dayKey = jours[date.getDay()];
      dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + sale.total);

      // 2. Clé Mois propre (ex: "Juin", "Juillet")
      const monthKey = mois[date.getMonth()];
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + sale.total);

      // 3. Clé Année
      const yearKey = date.getFullYear().toString();
      yearlyMap.set(yearKey, (yearlyMap.get(yearKey) || 0) + sale.total);
    });

    // Conversion en tableaux pour les barres graphiques
    let daily = Array.from(dailyMap.entries()).map(([date, valeur]) => ({ date, valeur }));
    let monthly = Array.from(monthlyMap.entries()).map(([date, valeur]) => ({ date, valeur }));
    let yearly = Array.from(yearlyMap.entries()).map(([date, valeur]) => ({ date, valeur }));

    // Si un magasin n'a pas encore de ventes pour la période, on initialise la barre actuelle
    const currentDayName = jours[new Date().getDay()];
    const currentMonthName = mois[new Date().getMonth()];
    const currentYearName = new Date().getFullYear().toString();

    if (daily.length === 0) daily = [{ date: currentDayName, valeur: 0 }];
    if (monthly.length === 0) monthly = [{ date: currentMonthName, valeur: 0 }];
    if (yearly.length === 0) yearly = [{ date: currentYearName, valeur: 0 }];

    return {
      storeName: store.name,
      summary: {
        totalProducts: currentProductsVolume,
        totalValue: currentStockValue,
        totalRevenue: totalSalesRevenue, // Lié au Chiffre d'affaires global
        unitsSold: totalUnitsSold,
      },
      daily,
      monthly,
      yearly,
    };
  }
}
