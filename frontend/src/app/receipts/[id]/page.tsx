'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

export default function ReceiptDetailPage() {
  const router = useRouter();
  const params = useParams() as { id?: string };
  const id = params?.id;
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [receipt, setReceipt] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API}/receipts/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('Impossible de charger le reçu');
        const data = await res.json();
        setReceipt(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Détail du Reçu</h1>
            <p className="text-sm text-slate-500">Visualisez les articles reçus et les montants.</p>
          </div>
          <div>
            <Button variant="outline" onClick={() => router.push('/receipts')}>← Retour reçus</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reçu</CardTitle>
            <CardDescription>{receipt ? `#${receipt.id} • ${new Date(receipt.createdAt).toLocaleString()}` : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-slate-400">Chargement...</div>
            ) : error ? (
              <div className="py-12 text-center text-red-500">{error}</div>
            ) : !receipt ? (
              <div className="py-12 text-center text-slate-400">Reçu introuvable.</div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-500">Fournisseur</div>
                    <div className="font-medium">{receipt.supplierName || receipt.supplier || '—'}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-500">Montant total</div>
                    <div className="font-medium">{Number(receipt.totalAmount).toFixed(2)} {receipt.currency || 'XOF'}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-3">Articles</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produit</TableHead>
                        <TableHead className="text-right">Quantité</TableHead>
                        <TableHead className="text-right">Prix Unitaire</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipt.items.map((it: any) => (
                        <TableRow key={it.id}>
                          <TableCell>{it.productName || it.productId || '—'}</TableCell>
                          <TableCell className="text-right">{it.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{Number(it.unitPrice).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-mono">{(Number(it.unitPrice) * Number(it.quantity)).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
