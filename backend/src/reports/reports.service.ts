import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildStoreIdWhere } from '../common/utils/store-access.util';

type Period = 'week' | 'month' | 'year';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Convertit proprement les identifiants d'URL en nombre.
   * Neutralise 'undefined', 'null', '' et NaN.
   */
  private parseId(id?: any): number | undefined {
    if (id === undefined || id === null || id === '' || id === 'undefined' || id === 'null') {
      return undefined;
    }
    const num = Number(id);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Construit la clause `where` sécurisée pour Prisma.
   *
   * BUGFIX : l'ancienne implémentation renvoyait `{}` (= AUCUN filtre = les
   * ventes/produits de TOUS les commerces confondus) pour un ADMIN sans
   * storeId précisé, et ne vérifiait même pas que le storeId demandé lui
   * appartenait. Elle délègue maintenant à `buildStoreIdWhere`, qui applique
   * la même règle stricte à tous les rôles.
   */
  private getStoreFilter(user: any, requestedStoreId?: number): { storeId?: any } {
    return buildStoreIdWhere(user, this.parseId(requestedStoreId));
  }

  /**
   * Ajuste et valide la plage de dates pour couvrir la journée entière.
   */
  private parseDateRange(startISO?: string, endISO?: string) {
    const now = new Date();
    const start = startISO ? new Date(startISO) : new Date(now.getFullYear(), now.getMonth(), 1);
    let end = endISO ? new Date(endISO) : new Date();

    const validStart = isNaN(start.getTime()) ? new Date() : start;
    let validEnd = isNaN(end.getTime()) ? new Date() : end;

    if (endISO && (endISO.length <= 10 || endISO.includes('T00:00:00'))) {
      validEnd.setUTCHours(23, 59, 59, 999);
    }

    return { start: validStart, end: validEnd };
  }

  async getKpis(startISO: string, endISO: string, storeId?: number, user?: any) {
    const { start, end } = this.parseDateRange(startISO, endISO);
    const storeWhere = await this.getStoreFilter(user, storeId);
    const parsedStoreId = this.parseId(storeId);

    const totalAgg = await this.prisma.sale.aggregate({
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: start, lte: end },
        ...storeWhere,
      },
    });
    const totalRevenue = totalAgg._sum?.totalAmount ? Number(totalAgg._sum.totalAmount) : 0;

    const products = await this.prisma.product.findMany({
      where: {
        quantity: { gt: 0 },
        deletedAt: null,
        ...storeWhere,
      },
      select: { quantity: true, sellingPrice: true },
    });
    
    const inventoryValue = products.reduce(
      (sum, p) => sum + Number(p.quantity || 0) * Number(p.sellingPrice || 0),
      0,
    );

    let currency = 'XOF';
    if (parsedStoreId) {
      const store = await this.prisma.store.findUnique({
        where: { id: parsedStoreId },
        select: { currency: true },
      });
      if (store?.currency) currency = store.currency;
    }

    return { totalRevenue, inventoryValue, currency };
  }

  async getSalesSeries(period: Period, startISO: string, endISO: string, storeId?: number, user?: any) {
    const { start, end } = this.parseDateRange(startISO, endISO);
    const storeWhere = await this.getStoreFilter(user, storeId);

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...storeWhere,
      },
      select: { totalAmount: true, createdAt: true },
    });

    const buckets = new Map<string, number>();
    for (const sale of sales) {
      const key = period === 'year' ? monthKey(sale.createdAt) : dayKey(sale.createdAt);
      buckets.set(key, (buckets.get(key) ?? 0) + Number(sale.totalAmount || 0));
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, amount]) => ({ date, amount }));
  }

  async getSalesDay(dateISO: string, storeId?: number, user?: any) {
    if (!dateISO) return [];
    
    const storeWhere = await this.getStoreFilter(user, storeId);
    const [y, m, d] = dateISO.slice(0, 10).split('-').map(Number);
    const start = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999));

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...storeWhere,
      },
      include: { 
        items: { 
          include: { 
            product: { select: { name: true } } 
          } 
        } 
      },
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
          amount: Number(item.total || 0),
        });
      }
    }
    return out;
  }

  async getStoresPerf(startISO: string, endISO: string, storeId?: number, user?: any) {
    const { start, end } = this.parseDateRange(startISO, endISO);
    const storeWhere = await this.getStoreFilter(user, storeId);

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...storeWhere,
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
      entry.salesAmount += Number(sale.totalAmount || 0);
      entry.salesCount += 1;
      grouped.set(sale.store.id, entry);
    }

    return Array.from(grouped.entries())
      .map(([id, v]) => ({ 
        storeId: id, 
        storeName: v.storeName, 
        salesAmount: v.salesAmount, 
        salesCount: v.salesCount 
      }))
      .sort((a, b) => b.salesAmount - a.salesAmount);
  }

  async getCashierDailyProducts(
    startISO: string,
    endISO: string,
    storeId?: number,
    currentUser?: any,
    filterCashierId?: number,
  ) {
    const { start, end } = this.parseDateRange(startISO, endISO);
    const storeWhere = await this.getStoreFilter(currentUser, storeId);
    const parsedUserId = this.parseId(filterCashierId);

    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(parsedUserId ? { userId: parsedUserId } : {}),
        ...storeWhere,
      },
      select: {
        id: true,
        createdAt: true,
        invoiceNumber: true,
        user: { select: { id: true, name: true, role: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            total: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    type DetailedProductRow = {
      productId: number;
      productName: string;
      receiptNumber: string;
      customerName: string;
      quantitySold: number;
      amountSold: number;
    };

    const byUser = new Map<string, { userId: string | number; userName: string; products: DetailedProductRow[] }>();
    const soldProductIds = new Set<number>();

    for (const sale of sales) {
      const userKey = sale.user ? String(sale.user.id) : 'unassigned';
      const roleLabel = sale.user?.role && sale.user.role !== 'CASHIER' ? ` (${sale.user.role})` : '';
      const userName = sale.user ? `${sale.user.name}${roleLabel}` : 'Ventes Directes / Non attribué';

      const userGroup = byUser.get(userKey) ?? {
        userId: sale.user ? sale.user.id : 'unassigned',
        userName: userName,
        products: [],
      };

      const receiptNo = sale.invoiceNumber || `#${sale.id}`;
      const custName = 'Client passage';

      for (const item of sale.items) {
        if (!item.product) continue;

        soldProductIds.add(item.product.id);

        userGroup.products.push({
          productId: item.product.id,
          productName: item.product.name,
          receiptNumber: receiptNo,
          customerName: custName,
          quantitySold: item.quantity,
          amountSold: Number(item.total || 0),
        });
      }

      byUser.set(userKey, userGroup);
    }

    const stockById = new Map<number, { quantity: number; sellingPrice: number }>();
    
    if (soldProductIds.size > 0) {
      const stockProducts = await this.prisma.product.findMany({
        where: {
          id: { in: Array.from(soldProductIds) },
        },
        select: { id: true, quantity: true, sellingPrice: true },
      });

      for (const p of stockProducts) {
        stockById.set(p.id, {
          quantity: p.quantity ?? 0,
          sellingPrice: Number(p.sellingPrice || 0),
        });
      }
    }

    return Array.from(byUser.values()).map((v) => ({
      userId: v.userId,
      userName: v.userName,
      products: v.products.map((p) => {
        const stock = stockById.get(p.productId);
        const remainingStock = stock?.quantity ?? 0;
        const sellingPrice = stock?.sellingPrice ?? 0;
        return {
          productId: p.productId,
          productName: p.productName,
          receiptNumber: p.receiptNumber,
          customerName: p.customerName,
          quantitySold: p.quantitySold,
          amountSold: p.amountSold,
          remainingStock,
          remainingStockValue: remainingStock * sellingPrice,
        };
      }),
    }));
  }
}

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date) {
  return d.toISOString().slice(0, 7);
}