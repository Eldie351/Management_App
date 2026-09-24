import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { DeleteSaleDto } from './dto/delete-sale.dto';
import {
  DiscountType,
  MovementType,
  Prisma,
  ReceiptActionType,
  TicketStatus,
  TicketType,
} from '@prisma/client';
import { assertStoreAccess, buildStoreIdWhere } from '../common/utils/store-access.util';

const SALE_INCLUDE = {
  items: { include: { product: true } },
  user: { select: { id: true, name: true, email: true } },
  store: true,
} as const;

/**
 * Calcul sécurisé de la remise, appliquée uniquement sur un sous-total
 * recalculé côté serveur (jamais sur une valeur fournie par le client).
 */
function computeDiscount(
  subtotal: number,
  discountType: DiscountType | null | undefined,
  rawDiscountValue: number,
) {
  const discountValue = discountType
    ? Math.max(0, discountType === DiscountType.PERCENT ? Math.min(rawDiscountValue, 100) : rawDiscountValue)
    : 0;
  const discountAmount = discountType
    ? Math.min(
        discountType === DiscountType.PERCENT ? (discountValue / 100) * subtotal : discountValue,
        subtotal,
      )
    : 0;
  return { discountValue, discountAmount, totalAmount: subtotal - discountAmount };
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createSale(userId: number, dto: CreateSaleDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Le panier ne peut pas être vide.');
    }

    // 1. Récupérer l'utilisateur avec TOUS ses magasins associés (assigned, owned, assignments)
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        assignedStoreId: true,
        ownedStores: { select: { id: true } },
        storeAssignments: { select: { storeId: true } },
      },
    });

    if (!currentUser) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // BUGFIX : cette vérification était sautée pour role === ADMIN,
    // permettant à n'importe quel ADMIN d'enregistrer une vente (donc de
    // décrémenter du stock) dans le magasin d'un AUTRE commerce. Elle
    // s'applique maintenant à tous les rôles, ADMIN inclus.
    assertStoreAccess(
      currentUser,
      dto.storeId,
      "Vous n'êtes pas autorisé à effectuer une vente dans ce magasin.",
    );

    // Transaction atomique : tout réussit ou tout est annulé
    return await this.prisma.$transaction(async (tx) => {
      // 2. Vérifier que le magasin existe et possède les informations obligatoires
      const store = await tx.store.findUnique({
        where: { id: dto.storeId },
        select: { id: true, name: true, location: true, phone: true, currency: true },
      });

      if (!store) {
        throw new NotFoundException('Magasin introuvable.');
      }

      if (!store.location || !store.phone) {
        throw new BadRequestException(
          'Les informations du magasin sont incomplètes. Veuillez renseigner l’adresse et le téléphone du magasin.',
        );
      }

      // 3. Récupération groupée des produits en base de données
      const productIds = dto.items.map((item) => item.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      let calculatedTotalAmount = 0;

      const verifiedItems: Array<{
        productId: number;
        quantity: number;
        unitPrice: number;
        total: number;
      }> = [];

      // 3. Validation et calcul sécurisé basé sur les données DB
      for (const item of dto.items) {
        const product = productMap.get(item.productId);

        if (!product || product.deletedAt) {
          throw new NotFoundException(
            `Produit ID ${item.productId} introuvable ou archivé.`,
          );
        }

        if (product.storeId !== dto.storeId) {
          throw new BadRequestException(
            `Le produit "${product.name}" n'appartient pas au magasin spécifié.`,
          );
        }

        if (product.quantity < item.quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour "${product.name}". Disponible: ${product.quantity}, Demandé: ${item.quantity}`,
          );
        }

        const itemUnitPrice = Number(product.sellingPrice);
        const itemTotal = itemUnitPrice * item.quantity;
        calculatedTotalAmount += itemTotal;

        verifiedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: itemUnitPrice,
          total: itemTotal,
        });
      }

      // 3bis. Calcul sécurisé de la remise (voir computeDiscount)
      const subtotal = calculatedTotalAmount;
      const discountType = dto.discountType;
      const { discountValue, discountAmount, totalAmount } = computeDiscount(
        subtotal,
        discountType,
        dto.discountValue ?? 0,
      );
      calculatedTotalAmount = totalAmount;

      // 4. Génération d'un numéro de facture unique en séquence par magasin et par année
      const year = new Date().getFullYear();
      const yearStart = new Date(`${year}-01-01T00:00:00.000Z`);
      const sequenceCount = await tx.sale.count({
        where: {
          storeId: dto.storeId,
          createdAt: { gte: yearStart },
        },
      });
      const sequenceNumber = String(sequenceCount + 1).padStart(4, '0');
      const invoiceNumber = `${year}-${dto.storeId}-${sequenceNumber}`;

      // 5. Enregistrement de la vente
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          subtotal,
          discountType,
          discountValue,
          discountAmount,
          totalAmount: calculatedTotalAmount,
          paymentMethod: dto.paymentMethod,
          customerName: dto.customerName?.trim() || null,
          storeId: dto.storeId,
          userId,
          items: {
            create: verifiedItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.total,
            })),
          },
        },
        include: {
          items: {
            include: { product: true },
          },
          user: { select: { id: true, name: true, email: true } },
          store: true,
        },
      });

      // 6. Mise à jour des stocks et enregistrement des mouvements
      for (const item of verifiedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { decrement: item.quantity },
          },
        });

        await tx.stockMovement.create({
          data: {
            quantity: -item.quantity,
            type: MovementType.SALE,
            note: `Vente ${sale.invoiceNumber}`,
            productId: item.productId,
            userId,
            storeId: dto.storeId,
          },
        });
      }

      // 7. Créer une notification pour informer managers/admins du magasin
      try {
        await this.notificationsService.create(
          dto.storeId,
          'Nouvelle vente',
          `Vente ${invoiceNumber} enregistrée — montant ${calculatedTotalAmount.toFixed(2)}`,
          tx,
        );
      } catch (e) {
        // Ignorer en cas d'erreur de notification
      }

      return sale;
    });
  }

  async findAllByStore(storeId: number) {
    return this.prisma.sale.findMany({
      where: { storeId },
      include: {
        items: { include: { product: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: SALE_INCLUDE,
    });

    if (!sale) {
      throw new NotFoundException(`Facture #${id} introuvable.`);
    }

    return sale;
  }

  /**
   * Modification complète a posteriori d'un reçu, réservée à l'ADMIN (voir
   * SalesController). Si `dto.items` est fourni, il remplace la liste des
   * articles et le stock est ajusté produit par produit de la DIFFÉRENCE
   * entre l'ancienne et la nouvelle quantité (mouvement ADJUSTMENT). Les
   * montants sont toujours recalculés côté serveur. Le motif est obligatoire
   * et consigné dans le journal d'audit.
   */
  async updateSale(id: number, dto: UpdateSaleDto, actorUserId: number) {
    const sale = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      let items = sale.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.total,
      }));

      if (dto.items) {
        const oldQtyByProduct = new Map<number, number>();
        for (const it of sale.items) {
          oldQtyByProduct.set(it.productId, (oldQtyByProduct.get(it.productId) ?? 0) + it.quantity);
        }
        const newQtyByProduct = new Map<number, number>();
        for (const it of dto.items) {
          newQtyByProduct.set(it.productId, (newQtyByProduct.get(it.productId) ?? 0) + it.quantity);
        }

        const productIds = Array.from(new Set([...oldQtyByProduct.keys(), ...newQtyByProduct.keys()]));
        const dbProducts = await tx.product.findMany({ where: { id: { in: productIds } } });
        const productMap = new Map(dbProducts.map((p) => [p.id, p]));

        for (const productId of newQtyByProduct.keys()) {
          const product = productMap.get(productId);
          // Un produit archivé depuis la vente reste accepté s'il figurait
          // déjà sur le reçu (on ne force pas à le retirer pour corriger
          // autre chose), mais ne peut pas y être ajouté.
          if (!product || (product.deletedAt && !oldQtyByProduct.has(productId))) {
            throw new NotFoundException(`Produit ID ${productId} introuvable ou archivé.`);
          }
          if (product.storeId !== sale.storeId) {
            throw new BadRequestException(
              `Le produit "${product.name}" n'appartient pas au magasin de ce reçu.`,
            );
          }
        }

        for (const productId of productIds) {
          const delta = (newQtyByProduct.get(productId) ?? 0) - (oldQtyByProduct.get(productId) ?? 0);
          if (delta === 0) continue;

          const product = productMap.get(productId);
          if (!product) continue; // produit supprimé définitivement : rien à restaurer

          if (delta > 0 && product.quantity < delta) {
            throw new BadRequestException(
              `Stock insuffisant pour "${product.name}". Disponible: ${product.quantity}, Supplément demandé: ${delta}`,
            );
          }

          await tx.product.update({
            where: { id: productId },
            data: { quantity: { decrement: delta } },
          });

          await tx.stockMovement.create({
            data: {
              quantity: -delta,
              type: MovementType.ADJUSTMENT,
              note: `Modification du reçu ${sale.invoiceNumber}`,
              productId,
              userId: actorUserId,
              storeId: sale.storeId,
            },
          });
        }

        items = dto.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.unitPrice * it.quantity,
        }));

        await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
        await tx.saleItem.createMany({
          data: items.map((it) => ({ ...it, saleId: sale.id })),
        });
      }

      const subtotal = items.reduce((sum, it) => sum + it.total, 0);
      const discountType = dto.discountType !== undefined ? dto.discountType : sale.discountType;
      const { discountValue, discountAmount, totalAmount } = computeDiscount(
        subtotal,
        discountType,
        dto.discountValue ?? sale.discountValue,
      );

      const updated = await tx.sale.update({
        where: { id },
        data: {
          subtotal,
          discountType,
          discountValue,
          discountAmount,
          totalAmount,
          ...(dto.customerName !== undefined && { customerName: dto.customerName.trim() || null }),
          ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
        },
        include: SALE_INCLUDE,
      });

      await this.auditLogService.log(
        actorUserId,
        `a modifié le reçu ${sale.invoiceNumber} — motif : ${dto.reason}`,
        'Sale',
        id,
        tx,
      );

      await this.recordReceiptAction(tx, {
        type: ReceiptActionType.UPDATE,
        sale,
        reason: dto.reason,
        totalAfter: totalAmount,
        actorUserId,
      });

      return updated;
    });
  }

  async deleteSale(id: number, dto: DeleteSaleDto, actorUserId: number) {
    const sale = await this.findOne(id);

    return this.prisma.$transaction(async (tx) => {
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: { increment: item.quantity },
          },
        });

        await tx.stockMovement.create({
          data: {
            quantity: item.quantity,
            type: MovementType.ADJUSTMENT,
            note: `Annulation de facture ${sale.invoiceNumber}`,
            productId: item.productId,
            userId: actorUserId,
            storeId: sale.storeId,
          },
        });
      }

      // Avant la suppression du reçu, tant que les tickets y sont encore
      // rattachés par saleId.
      await this.recordReceiptAction(tx, {
        type: ReceiptActionType.DELETE,
        sale,
        reason: dto.reason,
        totalAfter: null,
        actorUserId,
      });

      await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
      const deleted = await tx.sale.delete({ where: { id: sale.id } });

      await this.auditLogService.log(
        actorUserId,
        `a supprimé le reçu ${sale.invoiceNumber} — motif : ${dto.reason}`,
        'Sale',
        sale.id,
        tx,
      );

      return deleted;
    });
  }

  /**
   * Consigne une modification / suppression de reçu dans l'historique
   * (ReceiptAction) et traite les signalements encore ouverts sur ce reçu :
   *  - un ticket demandant CETTE action est validé (APPROVED) : c'est
   *    l'action de l'ADMIN qui valide le ticket, pas un clic sur "Valider".
   *  - en cas de suppression, un ticket demandant une modification devient
   *    sans objet et est fermé.
   */
  private async recordReceiptAction(
    tx: Prisma.TransactionClient,
    params: {
      type: ReceiptActionType;
      sale: { id: number; storeId: number; invoiceNumber: string; totalAmount: number };
      reason: string;
      totalAfter: number | null;
      actorUserId: number;
    },
  ) {
    const { type, sale, reason, totalAfter, actorUserId } = params;

    const openTickets = await tx.ticket.findMany({
      where: { saleId: sale.id, type: TicketType.RECEIPT, status: TicketStatus.OPEN },
    });
    const matchingTicket = openTickets.find((t) => t.requestedAction === type);

    await tx.receiptAction.create({
      data: {
        type,
        reason,
        invoiceNumber: sale.invoiceNumber,
        totalBefore: sale.totalAmount,
        totalAfter,
        saleId: sale.id,
        storeId: sale.storeId,
        userId: actorUserId,
        ticketId: matchingTicket?.id ?? null,
      },
    });

    const actionLabel = type === ReceiptActionType.DELETE ? 'supprimé' : 'modifié';
    for (const ticket of openTickets) {
      const approved = ticket.requestedAction === type;
      if (!approved && type !== ReceiptActionType.DELETE) continue;

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: approved ? TicketStatus.APPROVED : TicketStatus.CLOSED,
          resolutionNote: approved
            ? `Reçu ${actionLabel} — motif : ${reason}`
            : `Reçu supprimé — motif : ${reason}`,
          resolvedById: actorUserId,
          resolvedAt: new Date(),
        },
      });

      await this.notificationsService.create(
        sale.storeId,
        approved ? 'Ticket approuvé' : 'Ticket fermé',
        approved
          ? `Le signalement sur le reçu ${sale.invoiceNumber} a été validé : le reçu a été ${actionLabel}.`
          : `Le signalement sur le reçu ${sale.invoiceNumber} a été fermé : le reçu a été supprimé.`,
        tx,
      );

      await this.auditLogService.log(
        actorUserId,
        `${approved ? 'a validé' : 'a fermé'} le signalement sur le reçu ${sale.invoiceNumber}`,
        'Ticket',
        ticket.id,
        tx,
      );
    }
  }

  /**
   * Historique des modifications / suppressions de reçus sur les magasins
   * de l'utilisateur (ou un seul magasin si `storeId` est fourni).
   */
  async findReceiptActions(user: any, storeId?: number) {
    return this.prisma.receiptAction.findMany({
      where: buildStoreIdWhere(user, storeId),
      include: {
        user: { select: { id: true, name: true } },
        store: { select: { id: true, name: true, currency: true } },
        sale: { select: { id: true } },
        ticket: {
          select: {
            id: true,
            justification: true,
            createdAt: true,
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}
