import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Return shape: { totalRevenue, inventoryValue, currency }
  async getKpis(startISO: string, endISO: string) {
    const start = new Date(startISO);
    const end = new Date(endISO);

    // total revenue (sum of sale.amount in period)
    const totalAgg = await this.prisma.sale.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: start, lte: end } },
    });
    const totalRevenue = totalAgg._sum.amount ? Number(totalAgg._sum.amount) : 0;

    // inventory value: sum(quantity * unit_price) for current stock
    // Prisma aggregate doesn't support multiplication directly -> use raw SQL for Postgres
    const invRaw: any = await this.prisma.$queryRaw`
      SELECT COALESCE(SUM(quantity * unit_price), 0) as "inventoryValue" FROM "Inventory" WHERE quantity > 0
    `;
    const inventoryValue = invRaw && invRaw[0] && invRaw[0].inventoryValue ? Number(invRaw[0].inventoryValue) : 0;

    // Currency: choose a default, or derive from company/store settings.
    // Here we attempt to read a default currency from a Settings table; fallback to 'EUR'
    let currency = 'EUR';
    try {
      const setting = await this.prisma.setting.findUnique({ where: { key: 'default_currency' } });
      if (setting && setting.value) currency = setting.value;
    } catch {
      // ignore and fallback
    }

    return { totalRevenue, inventoryValue, currency };
  }

  // period: 'week'|'month'|'year'
  async getSalesSeries(period: 'week' | 'month' | 'year', startISO: string, endISO: string) {
    const start = new Date(startISO);
    const end = new Date(endISO);

    // For Postgres we use date_trunc to bucket: day for week/month views, month for year view
    if (period === 'year') {
      // bucket by month
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') as bucket, COALESCE(SUM(amount),0)::numeric as amount
        FROM "Sale"
        WHERE "createdAt" BETWEEN ${start} AND ${end}
        GROUP BY bucket
        ORDER BY bucket ASC
      `;
      return rows.map(r => ({ date: r.bucket, amount: Number(r.amount) }));
    } else {
      // bucket by day
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') as bucket, COALESCE(SUM(amount),0)::numeric as amount
        FROM "Sale"
        WHERE "createdAt" BETWEEN ${start} AND ${end}
        GROUP BY bucket
        ORDER BY bucket ASC
      `;
      return rows.map(r => ({ date: r.bucket, amount: Number(r.amount) }));
    }
  }

  async getSalesDay(dateISO: string) {
    const date = new Date(dateISO);
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // Assuming Sale has relation items: SaleItem with productId, quantity, unitPrice
    const sales = await this.prisma.sale.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: {
        items: { include: { product: true } }, // SaleItem -> product
      },
      orderBy: { createdAt: 'asc' },
    });

    const out: Array<{ id: string; productName: string; quantity: number; time: string; amount: number }> = [];
    for (const s of sales) {
      const saleTime = s.createdAt.toISOString();
      for (const it of s.items) {
        out.push({
          id: `${s.id}-${it.id}`,
          productName: it.product?.name ?? 'Produit inconnu',
          quantity: it.quantity,
          time: saleTime,
          amount: Number(it.quantity) * Number(it.unitPrice),
        });
      }
    }
    return out;
  }

  async getStoresPerf(startISO: string, endISO: string) {
    const start = new Date(startISO);
    const end = new Date(endISO);

    // Use groupBy to sum sales per store (Prisma groupBy)
    try {
      const grouped = await this.prisma.sale.groupBy({
        by: ['storeId'],
        _sum: { amount: true },
        where: { createdAt: { gte: start, lte: end } },
        orderBy: { _sum: { amount: 'desc' } },
      });
      const storeIds = grouped.map(g => g.storeId);
      const stores = await this.prisma.store.findMany({
        where: { id: { in: storeIds } },
        select: { id: true, name: true },
      });
      const storeMap = new Map(stores.map(s => [s.id, s.name]));
      return grouped.map(g => ({
        storeId: g.storeId,
        storeName: storeMap.get(g.storeId) ?? 'Magasin',
        salesAmount: g._sum.amount ? Number(g._sum.amount) : 0,
      }));
    } catch (e) {
      // Fallback raw SQL if groupBy fails
      const rows: any[] = await this.prisma.$queryRaw`
        SELECT s."storeId" as "storeId", st.name as "storeName", COALESCE(SUM(s.amount),0)::numeric as "salesAmount"
        FROM "Sale" s
        LEFT JOIN "Store" st ON st.id = s."storeId"
        WHERE s."createdAt" BETWEEN ${start} AND ${end}
        GROUP BY s."storeId", st.name
        ORDER BY "salesAmount" DESC
      `;
      return rows.map(r => ({ storeId: r.storeId, storeName: r.storeName, salesAmount: Number(r.salesAmount) }));
    }
  }
}
