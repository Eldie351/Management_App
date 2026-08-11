'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export default function ReceiptsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId');
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReceipts = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const url = storeId ? `${API}/receipts/store/${storeId}` : `${API}/receipts`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Impossible de charger l\'historique des reçus.');
      const data = await res.json();
      setReceipts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [storeId]);

  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Chargement...</div>}>
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          <div className="flex items-center justify-between border-b pb-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold">Historique des Reçus</h1>
              <p className="text-sm text-slate-500">Liste des réceptions de stock enregistrées{storeId ? ` pour le magasin #${storeId}` : ''}.</p>
            </div>
            <div>
              <Button variant="outline" onClick={() => router.push('/products')}>← Retour produits</Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Reçus enregistrés</CardTitle>
              <CardDescription>Historique des entrées de stock, fournisseur, quantités et montants.</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-12 text-center text-slate-400">Chargement...</div>
              ) : error ? (
                <div className="py-12 text-center text-red-500">{error}</div>
              ) : receipts.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Aucun reçu enregistré.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead className="text-right">Quantité totale</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-sm">{r.id}</TableCell>
                        <TableCell>{new Date(r.createdAt).toLocaleString()}</TableCell>
                        <TableCell>{r.supplierName || r.supplier || '—'}</TableCell>
                        <TableCell className="text-right">{r.totalQuantity ?? r.items?.reduce((s: number, it: any) => s + (it.quantity || 0), 0)}</TableCell>
                        <TableCell className="text-right font-mono">{Number(r.totalAmount ?? 0).toFixed(2)} {r.currency || 'XOF'}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => router.push(`/receipts/${r.id}`)}>Voir</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </Suspense>
  );
}
