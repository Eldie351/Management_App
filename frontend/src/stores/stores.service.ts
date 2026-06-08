async getStoreStats(storeId: number) {
  if (!this.prisma) {
    throw new InternalServerErrorException('PrismaService not available');
  }

  // Récupérer le magasin avec tous ses produits
  const store = await this.prisma.store.findUnique({
    where: { id: storeId },
    include: { products: true },
  });

  if (!store) throw new NotFoundException('Magasin introuvable.');

  // Calculs financiers réels basés sur l'inventaire actuel
  const totalProducts = store.products.reduce((acc, p) => acc + p.quantity, 0);
  const totalValue = store.products.reduce((acc, p) => acc + (p.price * p.quantity), 0);

  return {
    storeName: store.name,
    summary: {
      totalProducts,
      totalValue,
    },
    // Données temporelles simulées pour alimenter vos futurs graphiques Frontend
    daily: [
      { date: 'Lun', valeur: totalValue * 0.9 },
      { date: 'Mar', valeur: totalValue * 0.95 },
      { date: 'Mer', valeur: totalValue },
    ],
    monthly: [
      { date: 'Avr', valeur: totalValue * 0.8 },
      { date: 'Mai', valeur: totalValue * 0.85 },
      { date: 'Juin', valeur: totalValue },
    ],
    yearly: [
      { date: '2024', valeur: totalValue * 0.5 },
      { date: '2025', valeur: totalValue * 0.75 },
      { date: '2026', valeur: totalValue },
    ],
  };
}
