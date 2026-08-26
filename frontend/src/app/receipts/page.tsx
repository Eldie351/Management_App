'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingDots } from '@/components/ui/loading_dots';
import {
  Printer,
  Search,
  RefreshCw,
  FileText,
  X,
  Receipt as ReceiptIcon,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Store as StoreIcon,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

interface ReceiptItem {
  id?: number | string;
  productName?: string;
  name?: string;
  designation?: string;
  label?: string;
  title?: string;
  sku?: string | null;
  product?: { name?: string; title?: string; designation?: string; sku?: string | null };
  quantity?: number;
  qty?: number;
  unitPrice?: number;
  price?: number;
  total?: number;
  totalPrice?: number;
}

interface StoreItem {
  id: number | string;
  name?: string;
  title?: string;
  location?: string;
  address?: string;
  phone?: string;
  currency?: string;
}

interface Receipt {
  id: number | string;
  receiptNumber?: string;
  invoiceNumber?: string;
  createdAt?: string;
  date?: string;
  totalAmount?: number;
  total?: number;
  amount?: number;
  paymentMethod?: string;
  customerName?: string;
  discount?: number;
  amountReceived?: number;
  changeAmount?: number;
  user?: { name?: string; username?: string; fullName?: string };
  cashier?: string | { name?: string; username?: string; fullName?: string };
  cashierName?: string;
  userName?: string;
  storeName?: string;
  store?: StoreItem | string;
  stores?: StoreItem[];
  items?: ReceiptItem[];
  saleItems?: ReceiptItem[];
  receiptItems?: ReceiptItem[];
  currency?: string;
}

type Period = 'week' | 'month' | 'year';

interface DayCell {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const DAYS_FR_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}
function toDateKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}
function startOfYear(d: Date) {
  return new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
}
function endOfYear(d: Date) {
  return new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);
}
function shiftPeriod(d: Date, period: Period, delta: number) {
  const next = new Date(d);
  if (period === 'week') next.setDate(next.getDate() + delta * 7);
  if (period === 'month') next.setMonth(next.getMonth() + delta);
  if (period === 'year') next.setFullYear(next.getFullYear() + delta);
  return next;
}
function rangeLabel(period: Period, start: Date, end: Date) {
  if (period === 'week') {
    return `${pad(start.getDate())}/${pad(start.getMonth() + 1)} → ${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`;
  }
  if (period === 'month') {
    return `${MONTHS_FR[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `Année ${start.getFullYear()}`;
}
function buildMonthGrid(anchor: Date): DayCell[] {
  const today = new Date();
  const gridStart = startOfWeek(startOfMonth(anchor));
  const cells: DayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      date: d,
      key: toDateKey(d),
      inCurrentMonth: d.getMonth() === anchor.getMonth(),
      isToday: sameDay(d, today),
    });
  }
  return cells;
}

function ReceiptsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStoreId = searchParams.get('storeId');
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Liste des magasins & Magasin sélectionné
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [selectedStore, setSelectedStore] = useState<StoreItem | null>(null);

  // Reçus & Filtres
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  // 1. Charger la liste des magasins au montage
  const fetchStores = useCallback(async () => {
    setLoadingStores(true);
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const endpoints = [`${API}/stores`, `${API}/user/stores`, `${API}/my-stores`];
    let data = null;

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch {
        continue;
      }
    }

    if (data) {
      const list: StoreItem[] = Array.isArray(data) ? data : (data?.data ?? []);
      setStores(list);

      if (urlStoreId) {
        const found = list.find((s) => String(s.id) === String(urlStoreId));
        if (found) setSelectedStore(found);
      }
    }
    setLoadingStores(false);
  }, [API, router, urlStoreId]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  // Calcul de la période courante
  const { start, end, label } = useMemo(() => {
    let s: Date, e: Date;
    if (period === 'week') { s = startOfWeek(anchor); e = endOfWeek(anchor); }
    else if (period === 'month') { s = startOfMonth(anchor); e = endOfMonth(anchor); }
    else { s = startOfYear(anchor); e = endOfYear(anchor); }
    return { start: s, end: e, label: rangeLabel(period, s, e) };
  }, [period, anchor]);

  const weekDays = useMemo(() => {
    const s = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [anchor]);

  const monthGrid = useMemo(() => buildMonthGrid(anchor), [anchor]);

  function goPrev() { setAnchor((d) => shiftPeriod(d, period, -1)); }
  function goNext() { setAnchor((d) => shiftPeriod(d, period, 1)); }
  function goToday() { setAnchor(new Date()); setPeriod('week'); }

  // 2. Charger les reçus du magasin sélectionné
  const fetchReceipts = useCallback(async () => {
    if (!selectedStore) return;

    setLoading(true);
    setError('');
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const startIso = start.toISOString();
    const endIso = end.toISOString();
    const currentStoreId = selectedStore.id;

    const candidateUrls = [
      `${API}/sales/store/${currentStoreId}?start=${startIso}&end=${endIso}`,
      `${API}/receipts/store/${currentStoreId}?start=${startIso}&end=${endIso}`,
      `${API}/sales?storeId=${currentStoreId}&start=${startIso}&end=${endIso}`,
      `${API}/receipts?storeId=${currentStoreId}&start=${startIso}&end=${endIso}`,
    ];

    let data = null;

    for (const url of candidateUrls) {
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          data = await res.json();
          break;
        }
      } catch {
        continue;
      }
    }

    if (data !== null) {
      const rows = Array.isArray(data) ? data : (data?.data ?? []);
      setReceipts(rows);
    } else {
      setError('Impossible de charger les reçus pour ce magasin.');
    }
    setLoading(false);
  }, [API, router, selectedStore, start, end]);

  useEffect(() => {
    if (selectedStore) {
      fetchReceipts();
    }
  }, [selectedStore, fetchReceipts]);

  // Utilitaires de formatage
  const getReceiptNumber = (r: Receipt) => r.invoiceNumber || r.receiptNumber || `#${r.id}`;

  const getStoreObj = (r: Receipt): StoreItem | null => {
    if (typeof r.store === 'object' && r.store !== null) return r.store;
    if (Array.isArray(r.stores) && r.stores.length > 0) return r.stores[0];
    return selectedStore;
  };

  const getStoreName = (r: Receipt) => {
    const obj = getStoreObj(r);
    if (obj?.name) return obj.name;
    if (obj?.title) return obj.title;
    if (typeof r.store === 'string') return r.store;
    return r.storeName || selectedStore?.name || 'Magasin';
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

  const getItemSku = (it: ReceiptItem) => {
    return it.product?.sku || it.sku || 'N/A';
  };

  const getItemsList = (r: Receipt): ReceiptItem[] => {
    return r.items || r.saleItems || r.receiptItems || [];
  };

  const getTotalAmount = (r: Receipt) => Number(r.totalAmount ?? r.total ?? r.amount ?? 0);

  // Fonction d'impression identique à celle de SalesPage
  const printReceipt = (sale: Receipt | null) => {
    if (!sale) return;
    const items = getItemsList(sale);
    const storeObj = getStoreObj(sale);
    const storeName = getStoreName(sale);
    const storeLocation = storeObj?.location || storeObj?.address || '';
    const storePhone = storeObj?.phone || 'N/A';
    const formattedLocation = storeLocation
      ? storeLocation.includes('Bénin')
        ? storeLocation
        : `${storeLocation}, Bénin`
      : '';
    const currency = storeObj?.currency || sale.currency || selectedStore?.currency || 'XOF';
    const invoiceNum = getReceiptNumber(sale);
    const dateFormatted = sale.createdAt || sale.date
      ? `${new Date(sale.createdAt || sale.date!).toLocaleDateString('fr-FR')} à ${new Date(sale.createdAt || sale.date!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      : '—';
    const cashierName = getCashierName(sale);
    const customer = sale.customerName || 'Client de passage';
    const subtotal = getTotalAmount(sale);
    const discount = Number(sale.discount ?? 0);
    const amountReceived = Number(sale.amountReceived ?? 0);
    const changeAmount = Number(sale.changeAmount ?? 0);
    const paymentMethodLabel = sale.paymentMethod === 'CASH' ? 'Espèces' : sale.paymentMethod === 'MOBILE_MONEY' ? 'MoMo' : sale.paymentMethod === 'CARD' ? 'Carte' : sale.paymentMethod || 'Espèces';

    const html = `
      <html>
        <head>
          <title>Reçu ${invoiceNum}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #111; }
            h1, h2, h3 { margin: 0; }
            .invoice-header { text-align: center; margin-bottom: 12px; line-height: 1.4; }
            .invoice-header p { margin: 2px 0; }
            .divider { margin: 16px 0; border-top: 2px solid #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 8px 6px; border-bottom: 1px solid #ddd; text-align: left; }
            .summary { margin-top: 18px; }
            .summary div { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .total { font-weight: bold; font-size: 1rem; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            <h1>${storeName}</h1>
            ${formattedLocation ? `<p>${formattedLocation}</p>` : ''}
            <p>Tél : ${storePhone}</p>
          </div>
          <div class="divider"></div>
          <p><strong>FACTURE N° :</strong> ${invoiceNum}</p>
          <p><strong>Date :</strong> ${dateFormatted}</p>
          <p><strong>Vendeur :</strong> ${cashierName}</p>
          <p><strong>Client :</strong> ${customer}</p>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>SKU</th>
                <th>Qté</th>
                <th>PU</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map((it: ReceiptItem) => {
                  const qty = Number(it.quantity ?? it.qty ?? 1);
                  const pu = Number(it.unitPrice ?? it.price ?? 0);
                  const totalLine = it.total ?? it.totalPrice ? Number(it.total ?? it.totalPrice) : pu * qty;
                  return `
                    <tr>
                      <td>${getItemName(it)}</td>
                      <td>${getItemSku(it)}</td>
                      <td>${qty}</td>
                      <td>${pu.toFixed(2)}</td>
                      <td>${totalLine.toFixed(2)}</td>
                    </tr>
                  `;
                })
                .join('')}
            </tbody>
          </table>
          <div class="summary">
            <div><span>Sous-total</span><span>${subtotal.toFixed(2)} ${currency}</span></div>
            <div><span>Remise</span><span>${discount.toFixed(2)} ${currency}</span></div>
            ${amountReceived > 0 ? `<div><span>Montant reçu</span><span>${amountReceived.toFixed(2)} ${currency}</span></div>` : ''}
            <div class="total"><span>Total payé</span><span>${subtotal.toFixed(2)} ${currency}</span></div>
            ${amountReceived > 0 ? `<div><span>Rendu</span><span>${changeAmount.toFixed(2)} ${currency}</span></div>` : ''}
            <div><span>Mode</span><span>${paymentMethodLabel}</span></div>
          </div>
        </body>
      </html>
    `;
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  const filteredReceipts = receipts.filter((r) => {
    const query = searchQuery.toLowerCase();
    const number = getReceiptNumber(r).toLowerCase();
    const cashier = getCashierName(r).toLowerCase();
    const store = getStoreName(r).toLowerCase();
    return number.includes(query) || cashier.includes(query) || store.includes(query);
  });

  const getSelectedStoreLabel = () => {
    if (!selectedStore) return '';
    return selectedStore.name || selectedStore.title || `Magasin #${selectedStore.id}`;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        {/* EN-TÊTE PRINCIPAL */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Historique des Reçus</h1>
            <p className="text-sm text-slate-500">
              {selectedStore
                ? `Consultation des reçus : ${getSelectedStoreLabel()}`
                : 'Choisissez un magasin pour accéder à l\'historique des reçus.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedStore && (
              <>
                <Button variant="outline" size="sm" onClick={() => setSelectedStore(null)} className="gap-2">
                  <ArrowLeft className="w-4 h-4" /> Changer de magasin
                </Button>
                <Button variant="outline" size="sm" onClick={fetchReceipts} className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Actualiser
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* ÉTAPE 1 : SÉLECTION DU MAGASIN                                       */}
        {/* ==================================================================== */}
        {!selectedStore ? (
          <div className="max-w-4xl mx-auto py-6">
            <div className="text-center mb-8">
              <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
                <StoreIcon className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Sélectionnez un magasin</h2>
              <p className="text-sm text-slate-500 mt-1">
                Choisissez l'établissement dont vous souhaitez consulter les reçus de vente.
              </p>
            </div>

            {loadingStores ? (
              <div className="flex py-16 justify-center items-center">
                <LoadingDots size="h-4 w-4" color="bg-blue-600" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stores.map((store) => {
                  const storeName = store.name || store.title || `Magasin #${store.id}`;
                  return (
                    <Card
                      key={store.id}
                      onClick={() => setSelectedStore(store)}
                      className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all border-2 border-slate-200 bg-white"
                    >
                      <CardContent className="p-6 flex flex-col justify-between min-h-[140px]">
                        <div className="flex items-start justify-between">
                          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
                            <StoreIcon className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                            {store.currency || 'XOF'}
                          </span>
                        </div>
                        <div className="mt-4">
                          <h3 className="font-bold text-slate-800 text-base">{storeName}</h3>
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {store.location || store.address || 'Emplacement non renseigné'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ==================================================================== */
          /* ÉTAPE 2 : HISTORIQUE DES REÇUS                                       */
          /* ==================================================================== */
          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" /> Reçus enregistrés
                  </CardTitle>
                  <CardDescription className="flex items-center gap-1.5 mt-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />
                    Magasin actif : <strong className="text-slate-800">{getSelectedStoreLabel()}</strong> — {label}
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

              {/* Filtre Période + Calendrier */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <div className="flex bg-muted rounded-md overflow-hidden p-0.5">
                  {(['week', 'month', 'year'] as Period[]).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1.5 text-sm rounded-sm transition-colors ${
                        period === p ? 'bg-white shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Année'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={goPrev} title="Précédent">
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToday}>Aujourd'hui</Button>
                  <Button variant="outline" size="icon" onClick={goNext} title="Suivant">
                    <ChevronRight className="size-4" />
                  </Button>
                </div>

                <Button variant="outline" size="sm" onClick={() => setCalendarOpen((o) => !o)} aria-expanded={calendarOpen}>
                  <CalendarDays className="size-4" />
                  Calendrier
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {/* Panneau calendrier */}
              {calendarOpen && (
                <div className="mb-5 rounded-xl border bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <Button variant="ghost" size="icon" onClick={goPrev} title="Précédent">
                      <ChevronLeft className="size-4" />
                    </Button>
                    <p className="text-sm font-medium capitalize">
                      {period === 'year' ? anchor.getFullYear() : `${MONTHS_FR[anchor.getMonth()]} ${anchor.getFullYear()}`}
                    </p>
                    <Button variant="ghost" size="icon" onClick={goNext} title="Suivant">
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>

                  {period === 'week' && (
                    <div className="grid grid-cols-7 gap-1.5">
                      {weekDays.map((d) => {
                        const key = toDateKey(d);
                        const isToday = sameDay(d, new Date());
                        return (
                          <div
                            key={key}
                            className={`flex flex-col items-center gap-1 rounded-lg py-2.5 text-xs ${
                              isToday ? 'bg-muted font-medium ring-1 ring-primary/40' : ''
                            }`}
                          >
                            <span className="uppercase text-[10px] opacity-70">{DAYS_FR_SHORT[(d.getDay() + 6) % 7]}</span>
                            <span className="text-sm font-semibold">{d.getDate()}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {period === 'month' && (
                    <div>
                      <div className="grid grid-cols-7 text-center text-[11px] uppercase text-muted-foreground mb-1">
                        {DAYS_FR_SHORT.map((d) => <div key={d} className="py-1">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {monthGrid.map((cell) => (
                          <div
                            key={cell.key}
                            className={`aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg text-xs ${
                              !cell.inCurrentMonth ? 'text-muted-foreground/30'
                                : cell.isToday ? 'bg-muted font-medium ring-1 ring-primary/40'
                                : ''
                            }`}
                          >
                            <span>{cell.date.getDate()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {period === 'year' && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {MONTHS_FR.map((m, i) => (
                        <button
                          key={m}
                          onClick={() => { setAnchor(new Date(anchor.getFullYear(), i, 1)); setPeriod('month'); }}
                          className={`rounded-lg py-3 text-sm transition-colors ${
                            i === new Date().getMonth() && anchor.getFullYear() === new Date().getFullYear()
                              ? 'bg-muted font-medium ring-1 ring-primary/40'
                              : 'hover:bg-muted'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {loading ? (
                <div className="flex py-12 justify-center items-center">
                  <LoadingDots size="h-3 w-3" color="bg-blue-600" />
                </div>
              ) : error ? (
                <div className="py-12 text-center text-red-500 font-semibold">{error}</div>
              ) : filteredReceipts.length === 0 ? (
                <div className="py-12 text-center text-slate-400">Aucun reçu trouvé pour cette période.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Facture N°</TableHead>
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
                            ? new Date(r.createdAt || r.date!).toLocaleString('fr-FR', {
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })
                            : '—'}
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">{getStoreName(r)}</TableCell>
                        <TableCell className="text-slate-700">{getCashierName(r)}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-slate-900">
                          {getTotalAmount(r).toFixed(2)} {getStoreObj(r)?.currency || r.currency || 'XOF'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedReceipt(r)}
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
        )}
      </main>

      {/* MODAL DU REÇU CLIENT (Alignée à 100% sur SalesPage) */}
      {selectedReceipt && (() => {
        const storeObj = getStoreObj(selectedReceipt);
        const storeName = getStoreName(selectedReceipt);
        const storeLocation = storeObj?.location || storeObj?.address || '';
        const storePhone = storeObj?.phone || 'N/A';
        const formattedLocation = storeLocation ? (storeLocation.includes('Bénin') ? storeLocation : `${storeLocation}, Bénin`) : '';
        const currency = storeObj?.currency || selectedReceipt.currency || selectedStore?.currency || 'XOF';
        const items = getItemsList(selectedReceipt);
        const subtotal = getTotalAmount(selectedReceipt);
        const discount = Number(selectedReceipt.discount ?? 0);
        const amountReceived = Number(selectedReceipt.amountReceived ?? 0);
        const changeAmount = Number(selectedReceipt.changeAmount ?? 0);
        const paymentMethodLabel = selectedReceipt.paymentMethod === 'CASH' ? 'Espèces' : selectedReceipt.paymentMethod === 'MOBILE_MONEY' ? 'MoMo' : selectedReceipt.paymentMethod === 'CARD' ? 'Carte' : selectedReceipt.paymentMethod || 'Espèces';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setSelectedReceipt(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 print:hidden"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="font-sans text-sm text-gray-900 space-y-3">
                {/* En-tête de facture */}
                <div className="text-center pb-2 border-b">
                  <h2 className="font-bold text-xl uppercase tracking-wide">{storeName}</h2>
                  {formattedLocation && <p className="text-xs text-gray-600">{formattedLocation}</p>}
                  <p className="text-xs text-gray-600">Tél : {storePhone}</p>
                </div>

                {/* Métadonnées de vente */}
                <div className="text-xs space-y-1 py-1">
                  <p><strong>FACTURE N° :</strong> {getReceiptNumber(selectedReceipt)}</p>
                  <p>
                    <strong>Date :</strong>{' '}
                    {selectedReceipt.createdAt || selectedReceipt.date
                      ? `${new Date(selectedReceipt.createdAt || selectedReceipt.date!).toLocaleDateString('fr-FR')} à ${new Date(selectedReceipt.createdAt || selectedReceipt.date!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                      : '—'}
                  </p>
                  <p><strong>Vendeur :</strong> {getCashierName(selectedReceipt)}</p>
                  <p><strong>Client :</strong> {selectedReceipt.customerName || 'Client de passage'}</p>
                </div>

                {/* Tableau des articles */}
                <div className="border-t border-b py-2 my-2">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b">
                        <th className="py-1">Article</th>
                        <th className="py-1">SKU</th>
                        <th className="py-1 text-center">Qté</th>
                        <th className="py-1 text-right">PU</th>
                        <th className="py-1 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.length > 0 ? (
                        items.map((it, idx) => {
                          const qty = Number(it.quantity ?? it.qty ?? 1);
                          const pu = Number(it.unitPrice ?? it.price ?? 0);
                          const totalLine = it.total ?? it.totalPrice ? Number(it.total ?? it.totalPrice) : pu * qty;

                          return (
                            <tr key={it.id || idx} className="border-b border-gray-100">
                              <td className="py-1.5 font-medium">{getItemName(it)}</td>
                              <td className="py-1.5 text-gray-500 font-mono text-[10px]">{getItemSku(it)}</td>
                              <td className="py-1.5 text-center">{qty}</td>
                              <td className="py-1.5 text-right font-mono">{pu.toFixed(2)}</td>
                              <td className="py-1.5 text-right font-mono">{totalLine.toFixed(2)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-2 text-center text-xs text-gray-400">Aucun article</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Résumé des montants */}
                <div className="space-y-1 text-xs pt-1">
                  <div className="flex justify-between">
                    <span>Sous-total</span>
                    <span className="font-mono">{subtotal.toFixed(2)} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Remise</span>
                    <span className="font-mono">{discount.toFixed(2)} {currency}</span>
                  </div>
                  {amountReceived > 0 && (
                    <div className="flex justify-between">
                      <span>Montant reçu</span>
                      <span className="font-mono">{amountReceived.toFixed(2)} {currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm border-t pt-1">
                    <span>Total payé</span>
                    <span className="font-mono">{subtotal.toFixed(2)} {currency}</span>
                  </div>
                  {amountReceived > 0 && (
                    <div className="flex justify-between">
                      <span>Rendu</span>
                      <span className="font-mono">{changeAmount.toFixed(2)} {currency}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Mode</span>
                    <span>{paymentMethodLabel}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3 print:hidden">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedReceipt(null)}>
                  Fermer
                </Button>
                <Button className="flex-1 gap-2 bg-slate-900 hover:bg-slate-800 text-white" onClick={() => printReceipt(selectedReceipt)}>
                  <Printer className="w-4 h-4" /> Imprimer
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-full items-center justify-center bg-gray-100">
          <LoadingDots size="h-4 w-4" color="bg-blue-600" />
        </div>
      }
    >
      <ReceiptsContent />
    </Suspense>
  );
}