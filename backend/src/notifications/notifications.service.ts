import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Création "brute" d'une notification. Accepte un client Prisma classique
   * OU un client de transaction ($transaction) via `client`, pour pouvoir
   * être appelée depuis les transactions de ProductsService (vente,
   * ajustement...) sans risquer une notification créée alors que
   * l'opération d'origine a finalement échoué.
   */
  async create(
    storeId: number,
    title: string,
    message: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return client.notification.create({
      data: { storeId, title, message },
    });
  }

  async findAllByStore(storeId: number) {
    return this.prisma.notification.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: number) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification introuvable.');

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Détecte un franchissement de seuil et crée la notification adaptée.
   * Ne notifie QUE lors de la transition (pour ne pas spammer à chaque
   * vente tant que le produit reste sous le seuil).
   */
  async checkStockThreshold(
    client: Prisma.TransactionClient,
    params: {
      storeId: number;
      productId: number;
      productName: string;
      minimumStock: number;
      previousQuantity: number;
      newQuantity: number;
    },
  ) {
    const { storeId, productName, minimumStock, previousQuantity, newQuantity } = params;

    // Rupture de stock : franchissement de 0 vers <= 0
    if (newQuantity <= 0 && previousQuantity > 0) {
      await this.create(
        storeId,
        'Rupture de stock',
        `🚫 ${productName} est en rupture de stock.`,
        client,
      );
      return;
    }

    // Stock faible : franchissement du seuil minimum (mais encore > 0)
    if (newQuantity > 0 && newQuantity <= minimumStock && previousQuantity > minimumStock) {
      await this.create(
        storeId,
        'Stock faible',
        `⚠️ ${productName} est passé sous le seuil minimal (${newQuantity} restant, seuil : ${minimumStock}).`,
        client,
      );
    }
  }
}
