import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReceiptsService {
  constructor(private prisma: PrismaService) {}

  private mapRow(r: any) {
    return {
      ...r,
      totalAmount: (r.totalAmount as any) ? Number(r.totalAmount) : 0,
      items:
        r.items?.map((it: any) => ({
          ...it,
          unitPrice: it.unitPrice ? Number(it.unitPrice) : 0,
        })) || [],
    };
  }

  // storeId and id are numbers in Prisma schema
  async findAll(storeId?: number, startISO?: string, endISO?: string) {
    const where: any = {};
    if (typeof storeId !== 'undefined') where.storeId = storeId;
    if (startISO || endISO) {
      where.createdAt = {
        ...(startISO ? { gte: new Date(startISO) } : {}),
        ...(endISO ? { lte: new Date(endISO) } : {}),
      };
    }
    const rows = await this.prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true, user: { select: { id: true, name: true } } },
    });

    return rows.map((r: any) => this.mapRow(r));
  }

  /**
   * BUGFIX : utilisée quand aucun storeId précis n'est demandé (ex: un
   * ADMIN qui liste "tous ses reçus"). Avant, cette situation appelait
   * `findAll(undefined, ...)`, qui ne posait AUCUN filtre `storeId` et
   * renvoyait donc les reçus de TOUS les commerces de l'application.
   * Ici, on restreint explicitement aux magasins réellement autorisés.
   */
  async findAllForStores(storeIds: number[], startISO?: string, endISO?: string) {
    if (!storeIds || storeIds.length === 0) {
      return [];
    }

    const where: any = { storeId: { in: storeIds } };
    if (startISO || endISO) {
      where.createdAt = {
        ...(startISO ? { gte: new Date(startISO) } : {}),
        ...(endISO ? { lte: new Date(endISO) } : {}),
      };
    }

    const rows = await this.prisma.sale.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true, user: { select: { id: true, name: true } } },
    });

    return rows.map((r: any) => this.mapRow(r));
  }

  async findOne(id: number) {
    const r = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!r) throw new NotFoundException('Reçu introuvable');

    return this.mapRow(r);
  }
}
