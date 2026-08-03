import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // Ajustez le chemin selon votre structure Prisma
import { Currency } from '@prisma/client';

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Trouver un magasin par son ID (utilisé par StoresController.findOne)
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
    location?: string,
    currency?: Currency,
  ) {
    return this.prisma.store.create({
      data: {
        name,
        location,
        currency: currency || Currency.USD, // Valeur par défaut si non renseignée
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
    data: { name?: string; location?: string; currency?: Currency },
  ) {
    await this.findOne(id); // Vérifie que le magasin existe

    return this.prisma.store.update({
      where: { id },
      data,
    });
  }

  /**
   * Supprimer un magasin
   */
  async deleteStore(id: number) {
    await this.findOne(id); // Vérifie l'existence

    return this.prisma.store.delete({
      where: { id },
    });
  }

  /**
   * Récupérer les statistiques d'un magasin
   */
  async getStoreStats(storeId: number) {
    await this.findOne(storeId);

    const salesCount = await this.prisma.sale.count({
      where: { storeId },
    });

    const totalRevenue = await this.prisma.sale.aggregate({
      where: { storeId },
      _sum: { totalAmount: true },
    });

    return {
      salesCount,
      totalRevenue: totalRevenue._sum.totalAmount || 0,
    };
  }

  /**
   * Obtenir les ventes par période (semaine, mois, année)
   */
  async getSalesForPeriod(storeId: number, period: string, index: number) {
    await this.findOne(storeId);

    // Implémentation selon la logique de calcul de période
    return this.prisma.sale.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}