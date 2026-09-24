import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ReceiptActionType, TicketStatus, TicketType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { assertStoreAccess, buildStoreIdWhere, getAllowedStoreIds } from '../common/utils/store-access.util';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';
import { CreateReceiptTicketDto } from './dto/create-receipt-ticket.dto';

const TICKET_INCLUDE = {
  store: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, sku: true, quantity: true } },
  sale: { select: { id: true, invoiceNumber: true, totalAmount: true, createdAt: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  recipient: { select: { id: true, name: true, role: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

// Libellé de l'objet d'un ticket pour les notifications / le journal d'audit.
function describeTicketSubject(ticket: {
  type: TicketType;
  product?: { name: string } | null;
  saleInvoiceNumber?: string | null;
}) {
  return ticket.type === TicketType.RECEIPT
    ? `le reçu ${ticket.saleInvoiceNumber ?? ''}`.trim()
    : `"${ticket.product?.name ?? 'produit supprimé'}"`;
}

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createTicket(dto: CreateTicketDto, user: any) {
    assertStoreAccess(user, dto.storeId, "Vous n'avez pas accès à ce magasin.");

    if (dto.recipientId === user.id) {
      throw new BadRequestException('Vous ne pouvez pas vous adresser un ticket à vous-même.');
    }

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product || product.deletedAt) throw new NotFoundException('Produit introuvable.');
    if (product.storeId !== dto.storeId) {
      throw new NotFoundException("Ce produit n'appartient pas à ce magasin.");
    }

    // Le destinataire doit être un MANAGER/ADMIN ayant lui-même accès à ce
    // magasin (on ne peut pas adresser un ticket à quelqu'un d'étranger au
    // commerce, ni à un autre CASHIER).
    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientId },
      include: { ownedStores: true, storeAssignments: true },
    });
    if (!recipient) throw new NotFoundException('Destinataire introuvable.');
    if (recipient.role !== UserRole.ADMIN && recipient.role !== UserRole.MANAGER) {
      throw new BadRequestException('Le destinataire doit être un manager ou un administrateur.');
    }
    if (!getAllowedStoreIds(recipient).includes(dto.storeId)) {
      throw new BadRequestException("Ce destinataire n'a pas accès à ce magasin.");
    }

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          storeId: dto.storeId,
          productId: dto.productId,
          justification: dto.justification,
          requestedQuantity: dto.requestedQuantity,
          createdById: user.id,
          recipientId: dto.recipientId,
        },
        include: TICKET_INCLUDE,
      });

      await this.notificationsService.create(
        dto.storeId,
        'Nouvelle demande de réapprovisionnement',
        `Un ticket a été ouvert pour "${product.name}", adressé à ${recipient.name}.`,
        tx,
      );

      await this.auditLogService.log(
        user.id,
        `a ouvert un ticket de réapprovisionnement pour "${product.name}" (destinataire : ${recipient.name})`,
        'Ticket',
        ticket.id,
        tx,
      );

      return ticket;
    });
  }

  /**
   * Signalement d'un problème sur un reçu (doublon, erreur de montant...),
   * adressé à un ADMIN du magasin, seul habilité à modifier un reçu.
   */
  async createReceiptTicket(dto: CreateReceiptTicketDto, user: any) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: dto.saleId },
      select: { id: true, storeId: true, invoiceNumber: true },
    });
    if (!sale) throw new NotFoundException('Reçu introuvable.');

    assertStoreAccess(user, sale.storeId, "Vous n'avez pas accès à ce reçu.");

    if (dto.recipientId === user.id) {
      throw new BadRequestException('Vous ne pouvez pas vous adresser un ticket à vous-même.');
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: dto.recipientId },
      include: { ownedStores: true, storeAssignments: true },
    });
    if (!recipient) throw new NotFoundException('Destinataire introuvable.');
    if (recipient.role !== UserRole.ADMIN) {
      throw new BadRequestException('Un signalement de reçu doit être adressé à un administrateur.');
    }
    if (!getAllowedStoreIds(recipient).includes(sale.storeId)) {
      throw new BadRequestException("Ce destinataire n'a pas accès à ce magasin.");
    }

    const existing = await this.prisma.ticket.findFirst({
      where: { saleId: sale.id, type: TicketType.RECEIPT, status: TicketStatus.OPEN },
    });
    if (existing) {
      throw new BadRequestException('Un signalement est déjà en attente pour ce reçu.');
    }

    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.create({
        data: {
          type: TicketType.RECEIPT,
          storeId: sale.storeId,
          saleId: sale.id,
          saleInvoiceNumber: sale.invoiceNumber,
          requestedAction: dto.requestedAction,
          justification: dto.justification,
          createdById: user.id,
          recipientId: dto.recipientId,
        },
        include: TICKET_INCLUDE,
      });

      await this.notificationsService.create(
        sale.storeId,
        'Nouveau signalement de reçu',
        `Un ticket a été ouvert sur le reçu ${sale.invoiceNumber} (${
          dto.requestedAction === ReceiptActionType.DELETE ? 'suppression' : 'modification'
        } demandée), adressé à ${recipient.name}.`,
        tx,
      );

      await this.auditLogService.log(
        user.id,
        `a signalé le reçu ${sale.invoiceNumber} (destinataire : ${recipient.name})`,
        'Ticket',
        ticket.id,
        tx,
      );

      return ticket;
    });
  }

  async findAllByStore(storeId: number, user: any) {
    assertStoreAccess(user, storeId, "Vous n'avez pas accès à ce magasin.");

    return this.prisma.ticket.findMany({
      where: { storeId },
      include: TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Tickets de TOUS les magasins auxquels l'utilisateur a accès — pour la
   * vue "Tous les magasins" de la page Tickets.
   */
  async findAllForUser(user: any) {
    return this.prisma.ticket.findMany({
      where: buildStoreIdWhere(user),
      include: TICKET_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Nombre de tickets à surveiller pour le tableau de bord, dont le sens
   * dépend du rôle :
   *  - CASHIER : ses propres demandes encore en attente d'une réponse.
   *  - MANAGER : les tickets qui lui sont adressés et encore en attente.
   *  - ADMIN : l'ensemble des tickets en attente sur ses magasins (vue
   *    d'ensemble, puisqu'un ADMIN peut traiter n'importe quel ticket).
   */
  async countOpenTicketsForUser(user: any) {
    const storeIds = getAllowedStoreIds(user);
    if (storeIds.length === 0) return 0;

    if (user.role === UserRole.CASHIER) {
      return this.prisma.ticket.count({
        where: { storeId: { in: storeIds }, createdById: user.id, status: TicketStatus.OPEN },
      });
    }

    if (user.role === UserRole.MANAGER) {
      return this.prisma.ticket.count({
        where: { storeId: { in: storeIds }, recipientId: user.id, status: TicketStatus.OPEN },
      });
    }

    return this.prisma.ticket.count({
      where: { storeId: { in: storeIds }, status: TicketStatus.OPEN },
    });
  }

  private async resolveTicket(
    id: number,
    user: any,
    dto: ResolveTicketDto,
    targetStatus: typeof TicketStatus.APPROVED | typeof TicketStatus.CLOSED,
    action: string,
  ) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: { product: { select: { name: true } } },
    });
    if (!ticket) throw new NotFoundException('Ticket introuvable.');

    assertStoreAccess(user, ticket.storeId, "Vous n'avez pas accès à ce ticket.");

    // Seul le destinataire choisi peut traiter le ticket — sauf un ADMIN du
    // magasin, qui garde toujours la main même sur un ticket adressé à un MANAGER.
    if (user.role !== UserRole.ADMIN && user.id !== ticket.recipientId) {
      throw new ForbiddenException(
        'Seul le destinataire de ce ticket (ou un administrateur du magasin) peut le traiter.',
      );
    }

    if (ticket.status !== TicketStatus.OPEN) {
      throw new BadRequestException('Ce ticket a déjà été traité.');
    }

    // Un signalement de reçu est validé par l'action elle-même (modification
    // ou suppression du reçu, voir SalesService.recordReceiptAction), jamais
    // manuellement. Il peut en revanche être fermé (refusé).
    if (
      ticket.type === TicketType.RECEIPT &&
      ticket.requestedAction &&
      targetStatus === TicketStatus.APPROVED
    ) {
      throw new BadRequestException(
        "Ce signalement sera validé automatiquement une fois l'action demandée effectuée sur le reçu.",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.update({
        where: { id },
        data: {
          status: targetStatus,
          resolutionNote: dto.resolutionNote,
          resolvedById: user.id,
          resolvedAt: new Date(),
        },
        include: TICKET_INCLUDE,
      });

      await this.notificationsService.create(
        ticket.storeId,
        targetStatus === TicketStatus.APPROVED ? 'Ticket approuvé' : 'Ticket fermé',
        targetStatus === TicketStatus.APPROVED
          ? `Le ticket concernant ${describeTicketSubject(ticket)} a été approuvé.`
          : `Le ticket concernant ${describeTicketSubject(ticket)} a été fermé.`,
        tx,
      );

      await this.auditLogService.log(
        user.id,
        ticket.type === TicketType.RECEIPT
          ? `${action} le signalement sur ${describeTicketSubject(ticket)}`
          : `${action} le ticket de réapprovisionnement pour ${describeTicketSubject(ticket)}`,
        'Ticket',
        ticket.id,
        tx,
      );

      return updated;
    });
  }

  async approveTicket(id: number, user: any, dto: ResolveTicketDto) {
    return this.resolveTicket(id, user, dto, TicketStatus.APPROVED, 'a approuvé');
  }

  async closeTicket(id: number, user: any, dto: ResolveTicketDto) {
    return this.resolveTicket(id, user, dto, TicketStatus.CLOSED, 'a fermé');
  }
}
