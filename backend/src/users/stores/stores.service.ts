import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Currency } from '@prisma/client'; // 👈 AJOUTÉ : Importation de l'enum officiel de Prisma

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. CRÉER UN MAGASIN AVEC SA DEVISE CONFIGURÉE
   */
  async createStore(userId: number, name: string, location?: string, currency?: Currency) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const userExists = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) throw new NotFoundException("Utilisateur introuvable.");

    return this.prisma.store.create({
      data: {
        name,
        location,
        currency,
        userId,
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
   * 3bis. METTRE À JOUR LES PARAMÈTRES DU MAGASIN (nom, localisation, devise)
   */
  async updateStore(storeId: number, data: { name?: string; location?: string; currency?: Currency }) {
    if (!this.prisma) {
      throw new InternalServerErrorException('PrismaService not available');
    }

    const store = await this.prisma.store.findUnique({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Magasin introuvable.');

    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        name: data.name,
        location: data.location,
        currency: data.currency,
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
   * 4. CALCUL DES STATISTIQUES SÉCURISÉES PAR INDEX UNIQUES
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
        user: { select: { createdAt: true } }
      },
    });

    if (!store) throw new NotFoundException('Magasin introuvable.');

    const currentProductsVolume = store.products.reduce((acc, p) => acc + p.quantity, 0);
    // 👈 SÉCURISÉ : p.sellingPrice correspond maintenant parfaitement à ton nouveau schéma Prisma
    const currentStockValue = store.products.reduce((acc, p) => acc + (p.sellingPrice * p.quantity), 0);
    const totalSalesRevenue = store.sales.reduce((acc, s) => acc + s.total, 0);
    const totalUnitsSold = store.sales.reduce((acc, s) => acc + s.quantity, 0);

    const joursSemaine = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const moisAnnee = ['Janv', 'Févr', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

    const weeklyMap = new Map<number, number>();
    const monthlyMap = new Map<number, number>();
    const yearlyMap = new Map<number, number>();

    // Initialisation des structures avec des index numériques (0 à 6 pour les jours, 0 à 11 pour les mois)
    for (let i = 0; i < 7; i++) weeklyMap.set(i, 0);
    for (let i = 0; i < 12; i++) monthlyMap.set(i, 0);

    const registrationYear = store.user?.createdAt ? new Date(store.user.createdAt).getFullYear() : new Date().getFullYear();
    const currentYear = new Date().getFullYear();
    for (let year = registrationYear; year <= currentYear; year++) {
      yearlyMap.set(year, 0);
    }

    // Traitement des ventes
    store.sales.forEach((sale) => {
      const date = new Date(sale.createdAt);
      
      let dayIndex = date.getDay() - 1;
      if (dayIndex === -1) dayIndex = 6; // Lundi=0, Dimanche=6

      const monthIndex = date.getMonth(); // 0 à 11
      const yearKey = date.getFullYear();

      if (weeklyMap.has(dayIndex)) weeklyMap.set(dayIndex, weeklyMap.get(dayIndex)! + sale.total);
      if (monthlyMap.has(monthIndex)) monthlyMap.set(monthIndex, monthlyMap.get(monthIndex)! + sale.total);
      if (yearlyMap.has(yearKey)) yearlyMap.set(yearKey, yearlyMap.get(yearKey)! + sale.total);
    });

    // Envoi au frontend avec le label textuel pour l'affichage ET l'id numérique pour le calcul
    const daily = Array.from(weeklyMap.entries()).map(([id, valeur]) => ({ id, date: joursSemaine[id], valeur }));
    const monthly = Array.from(monthlyMap.entries()).map(([id, valeur]) => ({ id, date: moisAnnee[id], valeur }));
    const yearly = Array.from(yearlyMap.entries()).map(([id, valeur]) => ({ id, date: id.toString(), valeur }));

    return {
      storeName: store.name,
      currency: store.currency,
      summary: {
        totalProducts: currentProductsVolume,
        totalValue: currentStockValue,
        totalRevenue: totalSalesRevenue,
        unitsSold: totalUnitsSold,
      },
      weekly: daily,
      monthly,
      yearly,
    };
  }
}