import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReceiptsService {
  constructor(private prisma: PrismaService) {}

  async findAll(storeId?: string) {
    const where: any = {};
    if (storeId) where.storeId = storeId;
    const rows = await this.prisma.receipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });

    // Map decimals to numbers for frontend friendliness
    return rows.map(r => ({
      ...r,
      totalAmount: (r.totalAmount as any) ? Number(r.totalAmount) : 0,
      items: r.items?.map((it: any) => ({
        ...it,
        unitPrice: it.unitPrice ? Number(it.unitPrice) : 0,
      })) || [],
    }));
  }

  async findOne(id: string) {
    const r = await this.prisma.receipt.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!r) throw new NotFoundException('Reçu introuvable');

    return {
      ...r,
      totalAmount: (r.totalAmount as any) ? Number(r.totalAmount) : 0,
      items: r.items?.map((it: any) => ({
        ...it,
        unitPrice: it.unitPrice ? Number(it.unitPrice) : 0,
      })) || [],
    };
  }
}
