'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Printer, Eye, X } from 'lucide-react';

function ReceiptsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId');
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);

  const fetchReceipts = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const url = storeId ? `${API}/receipts/store/${storeId}` : `${API}/receipts`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `Erreur ${res.status}: Impossible de charger les reçus`);
      }

      const data = await res.json();
      setReceipts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [storeId]);

  const handlePrint = () => {
    window.print();
  };

  // extraction selon les propriétés de votre backend
  const getEntityName = (r: any) => {
    return r?.supplierName || r?.supplier || r?.storeName || r?.store?.name || '—';
  };

  const getUserName = (r: any) => {
    return r?.userName || r?.createdByName || r?.user?.username || r?.user?.name || r?.cashier || '—';
  };

  const getProductName = (it: any) => {
    return it?.productName || it?.product?.name || it?.productId || '—';
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Historique des Reçus</h1>
            <p className="text-sm text-slate-500">
              Consultation et réimpression des reçus{storeId ? ` pour le magasin #${storeId}` : ''}.
            </p>
          </div>
          <div>
            <Button variant="outline" onClick={() => router.push('/products')}>
              ← Retour produits
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reçus enregistrés</CardTitle>
            <CardDescription>Liste globale des reçus.</CardDescription>
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
                    <TableHead>ID du Reçu</TableHead>
                    <TableHead>Date & Heure</TableHead>
                    <TableHead>Fournisseur / Magasin</TableHead>
                    <TableHead className="text-right">Montant Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-sm font-bold">#{r.id}</TableCell>
                      <TableCell>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="font-medium">{getEntityName(r)}</TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {Number(r.totalAmount || 0).toFixed(2)} {r.currency || 'XOF'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/receipts/${r.id}`)}
                        >
                          Détails
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedReceipt(r)}
                          className="gap-1"
                        >
                          <Eye className="w-4 h-4" /> Ticket
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* MODAL TICKET D'IMPRESSION */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            <div id="printable-receipt" className="font-mono text-sm space-y-4 text-black">
              <div className="font-bold text-base border-b pb-2">
                Reçu #{selectedReceipt.id}
              </div>

              <div className="space-y-1 text-xs">
                <p><strong>Origine / Tiers:</strong> {getEntityName(selectedReceipt)}</p>
                <p><strong>Date:</strong> {selectedReceipt.createdAt ? new Date(selectedReceipt.createdAt).toLocaleString() : '—'}</p>
                <p><strong>Agent / Caissier:</strong> {getUserName(selectedReceipt)}</p>
              </div>

              <div className="border-t border-b py-2 my-2">
                <div className="grid grid-cols-4 font-bold border-b pb-1 mb-1 text-xs">
                  <span className="col-span-2">Produit</span>
                  <span className="text-center">Qté</span>
                  <span className="text-right">Montant</span>
                </div>
                {selectedReceipt.items?.map((it: any, idx: number) => {
                  const unitPrice = Number(it.unitPrice || it.price || 0);
                  const qty = Number(it.quantity || 1);
                  const totalLine = unitPrice * qty;

                  return (
                    <div key={it.id || idx} className="grid grid-cols-4 py-0.5 text-xs">
                      <span className="col-span-2 truncate">{getProductName(it)}</span>
                      <span className="text-center">{qty}</span>
                      <span className="text-right font-mono">{totalLine.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="font-bold text-base pt-1 flex justify-between">
                <span>Total:</span>
                <span>
                  {Number(selectedReceipt.totalAmount || 0).toFixed(2)} {selectedReceipt.currency || 'XOF'}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3 print:hidden">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedReceipt(null)}>
                Fermer
              </Button>
              <Button className="flex-1 gap-2" onClick={handlePrint}>
                <Printer className="w-4 h-4" /> Imprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Chargement...</div>}>
      <ReceiptsContent />
    </Suspense>
  );
}