import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReceiptsService {
  constructor(private prisma: PrismaService) {}

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

    // Map decimals to numbers for frontend friendliness
    return rows.map((r: any) => ({
      ...r,
      totalAmount: (r.totalAmount as any) ? Number(r.totalAmount) : 0,
      items:
        r.items?.map((it: any) => ({
          ...it,
          unitPrice: it.unitPrice ? Number(it.unitPrice) : 0,
        })) || [],
    }));
  }

  async findOne(id: number) {
    const r = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!r) throw new NotFoundException('Reçu introuvable');

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
}
