'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getStockLabel, getStockStatus } from '@/lib/stock-status';

export default function AlertsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch('http://localhost:3001/products/user/all', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) throw new Error('Impossible de charger les alertes produits.');
        const data = await res.json();
        setProducts(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [router]);

  const alertProducts = products.filter((product) => getStockStatus(product) !== 'IN_STOCK');

  if (loading) return <div className="flex h-screen items-center justify-center text-lg">Chargement des alertes...</div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-500 font-semibold">{error}</div>;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Alertes de stock</h1>
            <p className="mt-1 text-muted-foreground">Résumé complet des produits à surveiller sur l’ensemble des entrepôts.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
              {alertProducts.length} alerte{alertProducts.length > 1 ? 's' : ''}
            </div>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>← Tableau de bord</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Produits à surveiller</CardTitle>
            <CardDescription>Les statuts sont calculés à partir du stock actuel et du seuil minimum défini sur chaque produit.</CardDescription>
          </CardHeader>
          <CardContent>
            {alertProducts.length === 0 ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">
                Aucune alerte pour le moment. Tous les produits sont dans une zone saine.
              </div>
            ) : (
              <div className="space-y-3">
                {alertProducts.map((product) => {
                  const status = getStockStatus(product);
                  const statusInfo = getStockLabel(status);
                  return (
                    <div key={product.id} className={`rounded-lg border p-4 ${statusInfo.className}`}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="font-semibold">{product.name}</div>
                          <div className="text-sm opacity-80">
                            {product.store?.name || `Entrepôt #${product.storeId}`}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full border bg-white/70 px-3 py-1 text-xs font-semibold">
                            {statusInfo.label}
                          </span>
                          <span className="text-sm font-medium">Stock : {product.quantity} unité(s)</span>
                          <span className="text-xs text-slate-500">Seuil minimum : {product.minimumStock ?? 5}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
