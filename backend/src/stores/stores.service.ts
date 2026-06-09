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
   * 4. CALCUL DES STATISTIQUES AVEC HISTORIQUE DES ANNÉES DEPUIS L'INSCRIPTION
   */
  async getStoreStats(storeId: number) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    // 1. Récupérer le magasin avec ses produits, ses ventes ET l'utilisateur propriétaire
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { 
        products: true,
        sales: true,
        user: {
          select: { createdAt: true } // Permet de récupérer l'année exacte d'inscription
        }
      },
    });

    if (!store) {
      throw new NotFoundException('Magasin introuvable.');
    }

    const currentProductsVolume = store.products.reduce((acc, p) => acc + p.quantity, 0);
    const currentStockValue = store.products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
    const totalSalesRevenue = store.sales.reduce((acc, s) => acc + s.total, 0);
    const totalUnitsSold = store.sales.reduce((acc, s) => acc + s.quantity, 0);

    const joursSemaine = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const moisAnnee = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    const weeklyMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();
    const yearlyMap = new Map<string, number>();

    // 2. Pré-remplissage de la semaine et de l'année à 0
    joursSemaine.forEach(j => weeklyMap.set(j, 0));
    moisAnnee.forEach(m => monthlyMap.set(m, 0));
    
    // 3. 🎯 GÉNÉRATION DYNAMIQUE DE L'HISTORIQUE DES ANNÉES (Formule incrémentale)
    const registrationYear = store.user?.createdAt ? new Date(store.user.createdAt).getFullYear() : new Date().getFullYear();
    const currentYear = new Date().getFullYear();

    // On boucle de l'année d'inscription à l'année actuelle pour pré-remplir à 0
    for (let year = registrationYear; year <= currentYear; year++) {
      yearlyMap.set(year.toString(), 0);
    }

    // 4. Injection et calcul cumulé des ventes réelles
    store.sales.forEach((sale) => {
      const date = new Date(sale.createdAt);
      
      let dayIndex = date.getDay() - 1;
      if (dayIndex === -1) dayIndex = 6;
      const dayKey = joursSemaine[dayIndex];

      const monthKey = moisAnnee[date.getMonth()];
      const yearKey = date.getFullYear().toString();

      if (weeklyMap.has(dayKey)) weeklyMap.set(dayKey, weeklyMap.get(dayKey)! + sale.total);
      if (monthlyMap.has(monthKey)) monthlyMap.set(monthKey, monthlyMap.get(monthKey)! + sale.total);
      
      // Accumulation sur l'année (la clé existe forcément car créée dans la boucle d'incrémentation ci-dessus)
      if (yearlyMap.has(yearKey)) {
        yearlyMap.set(yearKey, yearlyMap.get(yearKey)! + sale.total);
      } else {
        // Sécurité si une vente était enregistrée sur une année antérieure à l'inscription par bug
        yearlyMap.set(yearKey, sale.total);
      }
    });

    const weekly = Array.from(weeklyMap.entries()).map(([date, valeur]) => ({ date, valeur }));
    const monthly = Array.from(monthlyMap.entries()).map(([date, valeur]) => ({ date, valeur }));
    
    // Tri chronologique des années pour le graphique
    const yearly = Array.from(yearlyMap.entries())
      .map(([date, valeur]) => ({ date, valeur }))
      .sort((a, b) => Number(a.date) - Number(b.date));

    return {
      storeName: store.name,
      summary: {
        totalProducts: currentProductsVolume,
        totalValue: currentStockValue,
        totalRevenue: totalSalesRevenue,
        unitsSold: totalUnitsSold,
      },
      weekly,
      monthly,
      yearly,
    };
  }
}
