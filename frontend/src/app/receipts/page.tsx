'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, Search, RefreshCw, FileText, X, Receipt as ReceiptIcon } from 'lucide-react';

interface ReceiptItem {
  id?: number;
  productName?: string;
  name?: string;
  designation?: string;
  label?: string;
  title?: string;
  product?: { name?: string; title?: string; designation?: string };
  quantity?: number;
  qty?: number;
  unitPrice?: number;
  price?: number;
  total?: number;
  totalPrice?: number;
}

interface Receipt {
  id: number;
  receiptNumber?: string;
  invoiceNumber?: string;
  createdAt?: string;
  date?: string;
  totalAmount?: number;
  total?: number;
  amount?: number;
  paymentMethod?: string;
  customerName?: string;
  user?: { name?: string; username?: string; fullName?: string };
  cashier?: string | { name?: string; username?: string; fullName?: string };
  cashierName?: string;
  userName?: string;
  storeName?: string;
  store?: { name?: string; title?: string; location?: string; currency?: string } | string;
  items?: ReceiptItem[];
  saleItems?: ReceiptItem[];
  receiptItems?: ReceiptItem[];
  currency?: string;
}

function ReceiptsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId');
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError('');
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const endpoint = storeId ? `${API}/receipts/store/${storeId}` : `${API}/receipts`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error(`Erreur ${res.status}: Impossible de charger les reçus`);
      }

      const data = await res.json();
      console.log('--- REÇUS REÇUS DE L\'API ---', data);
      setReceipts(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des reçus');
    } finally {
      setLoading(false);
    }
  }, [API, storeId, router]);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handlePrint = () => {
    window.print();
  };

  // Extractions ultra-flexibles
  const getReceiptNumber = (r: Receipt) => r.invoiceNumber || r.receiptNumber || `#${r.id}`;

  const getStoreName = (r: Receipt) => {
    if (typeof r.store === 'string') return r.store;
    return r.store?.name || r.store?.title || r.storeName || 'Magasin non renseigné';
  };

  const getCashierName = (r: Receipt) => {
    if (typeof r.cashier === 'string') return r.cashier;
    if (typeof r.cashier === 'object' && r.cashier) {
      return r.cashier.name || r.cashier.fullName || r.cashier.username;
    }
    return (
      r.user?.name ||
      r.user?.fullName ||
      r.user?.username ||
      r.cashierName ||
      r.userName ||
      'Non renseigné'
    );
  };

  const getItemName = (it: ReceiptItem) => {
    return (
      it.product?.name ||
      it.product?.title ||
      it.product?.designation ||
      it.productName ||
      it.designation ||
      it.name ||
      it.label ||
      it.title ||
      'Article sans nom'
    );
  };

  const getItemsList = (r: Receipt): ReceiptItem[] => {
    return r.items || r.saleItems || r.receiptItems || [];
  };

  const getTotalAmount = (r: Receipt) => Number(r.totalAmount ?? r.total ?? r.amount ?? 0);

  const filteredReceipts = receipts.filter((r) => {
    const query = searchQuery.toLowerCase();
    const number = getReceiptNumber(r).toLowerCase();
    const cashier = getCashierName(r).toLowerCase();
    const store = getStoreName(r).toLowerCase();
    return number.includes(query) || cashier.includes(query) || store.includes(query);
  });

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Historique des Reçus</h1>
            <p className="text-sm text-slate-500">
              Consultez et réimprimez les reçus enregistrés.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchReceipts} className="gap-2">
              <RefreshCw className="w-4 h-4" /> Actualiser
            </Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" /> Reçus enregistrés
                </CardTitle>
                <CardDescription>
                  {storeId ? `Reçus pour le magasin #${storeId}` : 'Historique complet des transactions'}
                </CardDescription>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Rechercher (N°, Caissier...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-slate-400">Chargement...</div>
            ) : error ? (
              <div className="py-12 text-center text-red-500">{error}</div>
            ) : filteredReceipts.length === 0 ? (
              <div className="py-12 text-center text-slate-400">Aucun reçu trouvé.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>N° Reçu</TableHead>
                    <TableHead>Date & Heure</TableHead>
                    <TableHead>Magasin</TableHead>
                    <TableHead>Caissier</TableHead>
                    <TableHead className="text-right">Montant Total</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReceipts.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono font-bold text-slate-800">
                        {getReceiptNumber(r)}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {r.createdAt || r.date
                          ? new Date(r.createdAt || r.date!).toLocaleString('en-US', {
                              dateStyle: 'short',
                              timeStyle: 'medium',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="font-medium text-slate-700">{getStoreName(r)}</TableCell>
                      <TableCell className="text-slate-700">{getCashierName(r)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">
                        {getTotalAmount(r).toFixed(2)} {typeof r.store === 'object' && r.store?.currency ? r.store.currency : r.currency || 'XOF'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            console.log('--- REÇU SÉLECTIONNÉ ---', r);
                            setSelectedReceipt(r);
                          }}
                          className="gap-1 bg-slate-900 text-white hover:bg-slate-800"
                        >
                          <ReceiptIcon className="w-4 h-4" /> Reçu
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

      {/* MODAL DU REÇU CLIENT */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6 relative">
            <button
              onClick={() => setSelectedReceipt(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 print:hidden"
            >
              <X className="w-5 h-5" />
            </button>

            <div id="printable-receipt" className="font-mono text-sm space-y-3 text-black bg-white">
              <h2 className="font-bold text-lg border-b pb-2">
                Reçu — {getReceiptNumber(selectedReceipt)}
              </h2>

              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-normal">Magasin:</span>{' '}
                  <span>{getStoreName(selectedReceipt)}</span>
                </p>
                <p>
                  <span className="font-normal">Date:</span>{' '}
                  <span>
                    {selectedReceipt.createdAt || selectedReceipt.date
                      ? new Date(selectedReceipt.createdAt || selectedReceipt.date!).toLocaleString('en-US', {
                          dateStyle: 'short',
                          timeStyle: 'medium',
                        })
                      : '—'}
                  </span>
                </p>
                <p>
                  <span className="font-normal">Caissier:</span>{' '}
                  <span>{getCashierName(selectedReceipt)}</span>
                </p>
              </div>

              <div className="border-t border-b py-2 my-2">
                <div className="grid grid-cols-4 font-bold text-sm border-b pb-1">
                  <span className="col-span-2">Article</span>
                  <span className="text-center">Qté</span>
                  <span className="text-right">Montant</span>
                </div>
                {getItemsList(selectedReceipt).length > 0 ? (
                  getItemsList(selectedReceipt).map((it, idx) => {
                    const unitPrice = Number(it.unitPrice ?? it.price ?? 0);
                    const qty = Number(it.quantity ?? it.qty ?? 1);
                    const totalLine = it.total ?? it.totalPrice ? Number(it.total ?? it.totalPrice) : unitPrice * qty;

                    return (
                      <div key={it.id || idx} className="grid grid-cols-4 py-1 text-sm">
                        <span className="col-span-2 truncate">{getItemName(it)}</span>
                        <span className="text-center">{qty}</span>
                        <span className="text-right font-mono">{totalLine.toFixed(2)}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-2 text-center text-xs text-gray-400">Aucun article</div>
                )}
              </div>

              <div className="font-bold text-sm pt-1">
                Total: {getTotalAmount(selectedReceipt).toFixed(2)}{' '}
                {typeof selectedReceipt.store === 'object' && selectedReceipt.store?.currency
                  ? selectedReceipt.store.currency
                  : selectedReceipt.currency || 'XOF'}
              </div>
            </div>

            <div className="mt-6 flex gap-3 print:hidden">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedReceipt(null)}>
                Fermer
              </Button>
              <Button className="flex-1 gap-2 bg-slate-900 hover:bg-slate-800 text-white" onClick={handlePrint}>
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