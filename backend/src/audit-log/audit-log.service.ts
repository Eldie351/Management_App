import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enregistre une action. Accepte un client de transaction pour être
   * appelée depuis les $transaction de ProductsService (le log n'est
   * persisté que si l'opération métier réussit entièrement).
   *
   * `action` : verbe court en français, ex: "a créé un produit",
   *            "a vendu 10 unités de Coca Cola", "a supprimé un produit".
   * `entity` : nom du modèle concerné, ex: "Product", "Category".
   * `entityId` : id de l'enregistrement concerné.
   */
  async log(
    userId: number,
    action: string,
    entity: string,
    entityId: number,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return client.auditLog.create({
      data: { userId, action, entity, entityId },
    });
  }

  async findAllByUser(userId: number, take = 100) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  /**
   * Journal complet d'un commerce : actions de l'ADMIN lui-même + actions de
   * tout le personnel qu'il a créé (MANAGER/CASHIER).
   *
   * BUGFIX (fonctionnel, pas de sécurité) : l'endpoint GET /audit-logs
   * n'appelait avant que `findAllByUser(adminId)`, qui ne renvoyait QUE les
   * actions effectuées par l'admin lui-même — jamais celles de son équipe.
   * Or la spec des permissions ADMIN demande explicitement de "voir tous les
   * logs" du commerce. On reste bien scopé à l'équipe de CET admin (pas de
   * fuite cross-tenant) via `createdById`.
   */
  async findAllForAdmin(adminId: number, take = 200) {
    const staff = await this.prisma.user.findMany({
      where: { createdById: adminId },
      select: { id: true },
    });

    const relevantUserIds = [adminId, ...staff.map((s) => s.id)];

    return this.prisma.auditLog.findMany({
      where: { userId: { in: relevantUserIds } },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
