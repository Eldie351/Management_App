export type StockStatus = 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';

export const getStockStatus = (product: any): StockStatus => {
  const minimumStock = Number(product?.minimumStock ?? 5);
  const quantity = Number(product?.quantity ?? 0);

  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity < minimumStock) return 'OUT_OF_STOCK';
  if (quantity <= minimumStock + 5) return 'LOW_STOCK';
  return 'IN_STOCK';
};

export const getStockLabel = (status: StockStatus) => {
  switch (status) {
    case 'OUT_OF_STOCK':
      return { label: '🔴 Rupture de stock', className: 'border-red-200 bg-red-50 text-red-700' };
    case 'LOW_STOCK':
      return { label: '🟠 Stock faible', className: 'border-orange-200 bg-orange-50 text-orange-700' };
    default:
      return { label: '🟢 En stock', className: 'border-green-200 bg-green-50 text-green-700' };
  }
};
