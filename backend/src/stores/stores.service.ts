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
   * 4. CALCULER LES STATISTIQUES AVEC GRAPHIQUES COMPLETS (MÊME SANS VENTES)
   */
  async getStoreStats(storeId: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { 
        products: true,
        sales: true,
      },
    });

    if (!store) throw new NotFoundException('Magasin introuvable.');

    // Calculs de base
    const currentProductsVolume = store.products.reduce((acc, p) => acc + p.quantity, 0);
    const currentStockValue = store.products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const totalSalesRevenue = store.sales.reduce((acc, s) => acc + s.total, 0);
    const totalUnitsSold = store.sales.reduce((acc, s) => acc + s.quantity, 0);

    // ------------------------------------------------------------
    // INITIALISATION DES GRAPHES COMPLETS À ZÉRO
    // ------------------------------------------------------------
    const jours = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const mois = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    const dailyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();
    const yearlyMap = new Map<string, number>();

    // On pré-remplit la semaine entière à 0
    jours.forEach(j => dailyMap.set(j, 0));

    // On pré-remplit l'année entière à 0
    mois.forEach(m => monthlyMap.set(m, 0));

    // On pré-remplit les 3 dernières années à 0 par défaut
    const currentYear = new Date().getFullYear();
    yearlyMap.set((currentYear - 2).toString(), 0);
    yearlyMap.set((currentYear - 1).toString(), 0);
    yearlyMap.set(currentYear.toString(), 0);

    // ------------------------------------------------------------
    // INJECTION DES VENTES RÉELLES DANS LE CALENDRIER
    // ------------------------------------------------------------
    store.sales.forEach((sale) => {
      const date = new Date(sale.createdAt);
      
      // Ajustement pour correspondre à notre tableau de jours propres (0=Dimanche, 1=Lundi...)
      let dayIndex = date.getDay() - 1;
      if (dayIndex === -1) dayIndex = 6; // Gérer le Dimanche (index 6 dans notre tableau jours)
      const dayKey = jours[dayIndex];
      
      const monthKey = mois[date.getMonth()];
      const yearKey = date.getFullYear().toString();

      // Accumulation des montants (remplace le 0 initial)
      if (dailyMap.has(dayKey)) dailyMap.set(dayKey, dailyMap.get(dayKey)! + sale.total);
      if (monthlyMap.has(monthKey)) monthlyMap.set(monthKey, monthlyMap.get(monthKey)! + sale.total);
      if (yearlyMap.has(yearKey)) yearlyMap.set(yearKey, yearlyMap.get(yearKey)! + sale.total);
    });

    // Conversion en tableaux ordonnés pour le Frontend
    const daily = Array.from(dailyMap.entries()).map(([date, valeur]) => ({ date, valeur }));
    const monthly = Array.from(monthlyMap.entries()).map(([date, valeur]) => ({ date, valeur }));
    const yearly = Array.from(yearlyMap.entries()).map(([date, valeur]) => ({ date, valeur }));

    return {
      storeName: store.name,
      summary: {
        totalProducts: currentProductsVolume,
        totalValue: currentStockValue,
        totalRevenue: totalSalesRevenue,
        unitsSold: totalUnitsSold,
      },
      daily,
      monthly,
      yearly,
    };
  }
}
