import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Period = 'week' | 'month' | 'year';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // Shape retournée : { totalRevenue, inventoryValue, currency }
  async getKpis(startISO: string, endISO: string, storeId?: number) {
    const start = new Date(startISO);
    const end = new Date(endISO);

    // Chiffre d'affaires réel : somme des ventes réalisées sur la période
    const totalAgg = await this.prisma.sale.aggregate({
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: start, lte: end },
        ...(storeId ? { storeId } : {}),
      },
    });
    const totalRevenue = totalAgg._sum?.totalAmount ? Number(totalAgg._sum.totalAmount) : 0;

    // Valeur d'inventaire : Σ(quantité restante × prix de vente) du stock courant,
    // indépendant de la période. Le stock vit directement sur Product (pas de table Inventory).
    const products = await this.prisma.product.findMany({
      where: {
        quantity: { gt: 0 },
        deletedAt: null,
        ...(storeId ? { storeId } : {}),
      },
      select: { quantity: true, sellingPrice: true },
    });
    const inventoryValue = products.reduce(
      (sum, p) => sum + Number(p.quantity) * Number(p.sellingPrice),
      0,
    );

    // Devise : celle du magasin filtré, sinon XOF (FCFA) par défaut.
    let currency = 'XOF';
    if (storeId) {
      const store = await this.prisma.store.findUnique({
        where: { id: storeId },
        select: { currency: true },
      });
      if (store?.currency) currency = store.currency;
    }

    return { totalRevenue, inventoryValue, currency };
  }

  // period: 'week' | 'month' | 'year'
  // Bucket en JS (plutôt qu'en SQL brut) pour rester indépendant du moteur de BDD
  // et du fuseau horaire de session Postgres.
  async getSalesSeries(period: Period, startISO: string, endISO: string, storeId?: number) {
    const start = new Date(startISO);
    const end = new Date(endISO);

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(storeId ? { storeId } : {}),
      },
      select: { totalAmount: true, createdAt: true },
    });

    const buckets = new Map<string, number>();
    for (const sale of sales) {
      const key = period === 'year' ? monthKey(sale.createdAt) : dayKey(sale.createdAt);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(sale.totalAmount));
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, amount]) => ({ date, amount }));
  }

  async getSalesDay(dateISO: string, storeId?: number) {
    // dateISO attendu au format YYYY-MM-DD (clé renvoyée par getSalesSeries).
    // On construit les bornes en UTC pour rester cohérent avec dayKey().
    const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
    const start = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999));

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(storeId ? { storeId } : {}),
      },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const out: Array<{ id: string; productName: string; quantity: number; time: string; amount: number }> = [];
    for (const sale of sales) {
      const saleTime = sale.createdAt.toISOString();
      for (const item of sale.items) {
        out.push({
          id: `${sale.id}-${item.id}`,
          productName: item.product?.name ?? 'Produit inconnu',
          quantity: item.quantity,
          time: saleTime,
          amount: Number(item.total),
        });
      }
    }
    return out;
  }

  async getStoresPerf(startISO: string, endISO: string, storeId?: number) {
    const start = new Date(startISO);
    const end = new Date(endISO);

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(storeId ? { storeId } : {}),
      },
      select: {
        totalAmount: true,
        store: { select: { id: true, name: true } },
      },
    });

    const grouped = new Map<number, { storeName: string; salesAmount: number; salesCount: number }>();
    for (const sale of sales) {
      if (!sale.store) continue;
      const entry = grouped.get(sale.store.id) ?? { storeName: sale.store.name, salesAmount: 0, salesCount: 0 };
      entry.salesAmount += Number(sale.totalAmount);
      entry.salesCount += 1;
      grouped.set(sale.store.id, entry);
    }

    return Array.from(grouped.entries())
      .map(([id, v]) => ({ storeId: id, storeName: v.storeName, salesAmount: v.salesAmount, salesCount: v.salesCount }))
      .sort((a, b) => b.salesAmount - a.salesAmount);
  }
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}
function monthKey(d: Date) {
  return d.toISOString().slice(0, 7); // YYYY-MM (UTC)
}
