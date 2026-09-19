import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TicketStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { assertStoreAccess, getAllowedStoreIds } from '../common/utils/store-access.util';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';

const TICKET_INCLUDE = {
  product: { select: { id: true, name: true, sku: true, quantity: true } },
  createdBy: { select: { id: true, name: true, role: true } },
  recipient: { select: { id: true, name: true, role: true } },
  resolvedBy: { select: { id: true, name: true } },
} as const;

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

  async findAllByStore(storeId: number, user: any) {
    assertStoreAccess(user, storeId, "Vous n'avez pas accès à ce magasin.");

    return this.prisma.ticket.findMany({
      where: { storeId },
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
          ? `Le ticket concernant "${ticket.product.name}" a été approuvé.`
          : `Le ticket concernant "${ticket.product.name}" a été fermé.`,
        tx,
      );

      await this.auditLogService.log(
        user.id,
        `${action} le ticket de réapprovisionnement pour "${ticket.product.name}"`,
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
