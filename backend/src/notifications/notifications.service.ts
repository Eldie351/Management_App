import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { assertStoreAccess } from '../common/utils/store-access.util';

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

  async markAsRead(id: number, user: any) {
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) throw new NotFoundException('Notification introuvable.');

    // BUGFIX : aucune vérification n'existait — n'importe quel ADMIN/MANAGER
    // pouvait marquer comme lue une notification d'un autre commerce.
    assertStoreAccess(user, notification.storeId, "Vous n'avez pas accès à cette notification.");

    return this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  /**
   * Détecte un franchissement de seuil et crée la notification adaptée.
   * Utilise exactement le même calcul de repli (fallback) que le ProductsService.
   * Ne notifie QUE lors du franchissement effectif du seuil (anti-spam).
   */
  async checkStockThreshold(
    client: Prisma.TransactionClient,
    params: {
      storeId: number;
      productId: number;
      productName: string;
      minimumStock: number;
      safetyStock?: number | null;
      previousQuantity: number;
      newQuantity: number;
    },
  ) {
    const {
      storeId,
      productName,
      minimumStock,
      safetyStock: explicitSafetyStock,
      previousQuantity,
      newQuantity,
    } = params;

    // 1. Calcul du safetyStock réel (aligné sur ProductsService : fallback = floor(minimumStock / 2))
    const effectiveSafetyStock =
      explicitSafetyStock !== undefined && explicitSafetyStock !== null
        ? explicitSafetyStock
        : Math.floor(minimumStock / 2);

    // 2. Rupture de stock : franchissement de 0 vers <= 0
    if (newQuantity <= 0 && previousQuantity > 0) {
      await this.create(
        storeId,
        'Rupture de stock',
        `🚫 ${productName} est en rupture de stock.`,
        client,
      );
      return;
    }

    // 3. Stock critique (Safety Stock) : passage de > safetyStock à <= safetyStock
    if (
      newQuantity > 0 &&
      newQuantity <= effectiveSafetyStock &&
      previousQuantity > effectiveSafetyStock
    ) {
      await this.create(
        storeId,
        'Stock critique (Urgence)',
        `🚨 ${productName} a atteint son seuil de sécurité critique (${newQuantity} restant, seuil de sécurité : ${effectiveSafetyStock}). Réapprovisionnement immédiat requis !`,
        client,
      );
      return;
    }

    // 4. Stock faible (Minimum Stock) : passage de > minimumStock à <= minimumStock
    if (
      newQuantity > effectiveSafetyStock &&
      newQuantity <= minimumStock &&
      previousQuantity > minimumStock
    ) {
      await this.create(
        storeId,
        'Stock faible',
        `⚠️ ${productName} est passé sous le seuil minimal (${newQuantity} restant, seuil minimal : ${minimumStock}).`,
        client,
      );
    }
  }
}