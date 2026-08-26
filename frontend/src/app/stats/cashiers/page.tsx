'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { LoadingDots } from '@/components/ui/loading_dots';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays, 
  PackageSearch, 
  TrendingUp, 
  ShoppingCart, 
  Boxes,
  Search,
  FileText,
  User,
  HelpCircle
} from 'lucide-react';
import { getStoredUserRole } from '@/lib/auth';

// ----------------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------------
type Period = 'week' | 'month' | 'year';

interface StoreOption {
  id: number;
  name: string;
  currency?: string;
}

interface DayCell {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

interface CashierProductRow {
  productId: number | string;
  productName: string;
  receiptNumber?: string;
  customerName?: string;
  quantitySold: number;
  amountSold: number;
  remainingStock: number;
  remainingStockValue: number;
}

interface CashierGroup {
  userId: number | string;
  userName: string;
  products: CashierProductRow[];
}

// ----------------------------------------------------------------------------------
// Constantes & helpers date
// ----------------------------------------------------------------------------------
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
function startOfDay(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}
function endOfDay(d: Date) {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
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
function currencyFormatter(currency: string) {
  return (amount: number) => {
    try {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount || 0);
    } catch {
      return `${(amount || 0).toLocaleString('fr-FR')} ${currency}`;
    }
  };
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

// ----------------------------------------------------------------------------------
// Helper de normalisation
// ----------------------------------------------------------------------------------
function normalizeCashierData(data: any): CashierGroup[] {
  if (!data) return [];
  const rawList = Array.isArray(data) ? data : (data.data ?? data.cashiers ?? data.items ?? []);
  if (rawList.length === 0) return [];

  if (rawList[0] && Array.isArray(rawList[0].products)) {
    return rawList.map((g: any) => ({
      userId: g.userId ?? g.cashierId ?? 'unassigned',
      userName: g.userName ?? g.cashierName ?? 'Ventes Directes / Non attribué',
      products: (g.products || []).map((p: any) => ({
        productId: p.productId ?? p.id ?? '',
        productName: p.productName ?? p.name ?? 'Produit',
        receiptNumber: p.receiptNumber ?? p.receiptNo ?? p.reference ?? 'N/A',
        customerName: p.customerName ?? p.client ?? 'Client passage',
        quantitySold: Number(p.quantitySold ?? p.quantity ?? 0),
        amountSold: Number(p.amountSold ?? p.totalAmount ?? p.total ?? 0),
        remainingStock: Number(p.remainingStock ?? p.stock ?? 0),
        remainingStockValue: Number(p.remainingStockValue ?? (Number(p.remainingStock || 0) * Number(p.price || 0))),
      })),
    }));
  }

  const groupsMap = new Map<string, CashierGroup>();

  rawList.forEach((item: any) => {
    const cashierId = String(item.userId ?? item.cashierId ?? item.user_id ?? 'unassigned');
    const cashierName = item.userName ?? item.cashierName ?? item.user_name ?? item.user?.name ?? 'Ventes Directes / Non attribué';

    if (!groupsMap.has(cashierId)) {
      groupsMap.set(cashierId, {
        userId: cashierId,
        userName: cashierName,
        products: [],
      });
    }

    groupsMap.get(cashierId)!.products.push({
      productId: item.productId ?? item.id ?? '',
      productName: item.productName ?? item.name ?? item.product_name ?? 'Produit',
      receiptNumber: item.receiptNumber ?? item.receiptNo ?? item.reference ?? 'N/A',
      customerName: item.customerName ?? item.client ?? item.customer_name ?? 'Client passage',
      quantitySold: Number(item.quantitySold ?? item.quantity ?? 0),
      amountSold: Number(item.amountSold ?? item.totalAmount ?? item.total ?? 0),
      remainingStock: Number(item.remainingStock ?? item.stock ?? 0),
      remainingStockValue: Number(item.remainingStockValue ?? 0),
    });
  });

  return Array.from(groupsMap.values());
}

// ----------------------------------------------------------------------------------
// Composant principal
// ----------------------------------------------------------------------------------
export default function CashiersStatsPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [, setRole] = useState<string | null>(null);

  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string>(() => toDateKey(new Date()));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [storeFilter, setStoreFilter] = useState<string>('');

  const [groups, setGroups] = useState<CashierGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { start, end, label } = useMemo(() => {
    if (selectedDay) {
      const [y, m, d] = selectedDay.split('-').map(Number);
      const day = new Date(y, (m ?? 1) - 1, d ?? 1);
      return {
        start: startOfDay(day),
        end: endOfDay(day),
        label: sameDay(day, new Date())
          ? "Aujourd'hui"
          : `${pad(day.getDate())}/${pad(day.getMonth() + 1)}/${day.getFullYear()}`,
      };
    }
    let s: Date, e: Date;
    if (period === 'week') { s = startOfWeek(anchor); e = endOfWeek(anchor); }
    else if (period === 'month') { s = startOfMonth(anchor); e = endOfMonth(anchor); }
    else { s = startOfYear(anchor); e = endOfYear(anchor); }
    return { start: s, end: e, label: rangeLabel(period, s, e) };
  }, [selectedDay, period, anchor]);

  const weekDays = useMemo(() => {
    const s = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  }, [anchor]);

  const monthGrid = useMemo(() => buildMonthGrid(anchor), [anchor]);

  const getToken = () => localStorage.getItem('access_token') || localStorage.getItem('token');

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }
    const r = getStoredUserRole();
    setRole(r);
    setCheckingAccess(false);
  }, [router]);

  const authedFetch = useCallback(async (path: string) => {
    const token = getToken();
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      router.push('/login');
      return null;
    }
    if (!res.ok) {
      let message = `Erreur ${res.status}`;
      try {
        const data = await res.json();
        if (data?.message) message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      } catch { /* conserve l'erreur */ }
      throw new Error(message);
    }
    return res.json();
  }, [API, router]);

  useEffect(() => {
    if (checkingAccess) return;
    (async () => {
      try {
        const data = await authedFetch('/stores');
        if (!data) return;
        const list = Array.isArray(data) ? data : (data.data ?? []);
        setStoreOptions(list.map((s: any) => ({ id: s.id, name: s.name, currency: s.currency })));
      } catch (err) {
        console.error('Erreur chargement des magasins', err);
      }
    })();
  }, [checkingAccess, authedFetch]);

  useEffect(() => {
    if (checkingAccess) return;

    let canceled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const storeParam = storeFilter ? `&storeId=${encodeURIComponent(storeFilter)}` : '';
        const startISO = encodeURIComponent(start.toISOString());
        const endISO = encodeURIComponent(end.toISOString());
        
        const path = `/reports/cashiers/daily-products?start=${startISO}&end=${endISO}${storeParam}`;
        const data = await authedFetch(path);
        
        if (canceled || data === null) return;
        
        const normalized = normalizeCashierData(data);
        setGroups(normalized);
      } catch (err: any) {
        console.error('Erreur chargement du rapport caissiers', err);
        if (!canceled) {
          setGroups(null);
          setError(err?.message || 'Impossible de charger le rapport.');
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [checkingAccess, storeFilter, start, end, authedFetch]);

  function goPrev() { setSelectedDay(''); setAnchor((d) => shiftPeriod(d, period, -1)); }
  function goNext() { setSelectedDay(''); setAnchor((d) => shiftPeriod(d, period, 1)); }
  function goToday() { setSelectedDay(toDateKey(new Date())); setAnchor(new Date()); setPeriod('week'); }
  function pickDay(key: string) { setSelectedDay(key); }
  function pickPeriod(p: Period) { setSelectedDay(''); setPeriod(p); }

  const currentStore = storeOptions.find((s) => String(s.id) === storeFilter);
  const formatCurrency = useMemo(() => currencyFormatter(currentStore?.currency ?? 'XOF'), [currentStore]);

  const globalStats = useMemo(() => {
    if (!groups) return { totalSales: 0, totalQtySold: 0, totalStockValue: 0 };
    let totalSales = 0;
    let totalQtySold = 0;

    const uniqueProductStock = new Map<string | number, number>();

    groups.forEach((g) => {
      (g.products || []).forEach((p) => {
        totalSales += Number(p.amountSold || 0);
        totalQtySold += Number(p.quantitySold || 0);

        if (p.productId && !uniqueProductStock.has(p.productId)) {
          uniqueProductStock.set(p.productId, Number(p.remainingStockValue || 0));
        }
      });
    });

    const totalStockValue = Array.from(uniqueProductStock.values()).reduce(
      (acc, val) => acc + val,
      0
    );

    return { totalSales, totalQtySold, totalStockValue };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    if (!searchQuery.trim()) return groups;

    const q = searchQuery.toLowerCase().trim();
    return groups
      .map((g) => {
        const matchesCashier = g.userName.toLowerCase().includes(q);
        const filteredProducts = (g.products || []).filter((p) => {
          const matchesReceipt = p.receiptNumber ? p.receiptNumber.toLowerCase().includes(q) : false;
          const matchesProduct = p.productName ? p.productName.toLowerCase().includes(q) : false;
          return matchesReceipt || matchesProduct;
        });

        if (matchesCashier || filteredProducts.length > 0) {
          return {
            ...g,
            products: matchesCashier ? g.products : filteredProducts,
          };
        }
        return null;
      })
      .filter((g): g is CashierGroup => g !== null);
  }, [groups, searchQuery]);

  if (checkingAccess) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100">
        <LoadingDots />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        
        <div className="border-b pb-4 mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Statistiques Caissiers</h1>
          <p className="mt-1 text-sm text-gray-500">
            Rapport quotidien des ventes par caissier et numéro de reçu
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-3 mb-6">
          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ventes Totales</CardTitle>
              <TrendingUp className="size-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(globalStats.totalSales)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Généré sur la période</p>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Articles Vendus</CardTitle>
              <ShoppingCart className="size-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{globalStats.totalQtySold}</div>
              <p className="text-xs text-muted-foreground mt-1">Total unités vendues</p>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Valeur Stock Restant</CardTitle>
              <Boxes className="size-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {formatCurrency(globalStats.totalStockValue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Stock disponible en magasin</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-col gap-4 pb-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Point des Ventes Quotidien</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Période : <span className="font-semibold text-foreground">{label}</span></p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {storeOptions.length > 0 && (
                <select
                  value={storeFilter}
                  onChange={(e) => setStoreFilter(e.target.value)}
                  className="px-3 py-2 text-sm border rounded-md bg-white shadow-sm min-w-[160px]"
                >
                  {storeOptions.map((s) => (
                    <option key={s.id} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              )}

              <div className="relative min-w-[260px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par caissier, reçu, produit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>

              <div className="flex bg-muted rounded-md overflow-hidden p-0.5">
                {(['week', 'month', 'year'] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => pickPeriod(p)}
                    className={`px-3 py-1.5 text-sm rounded-sm transition-colors ${
                      period === p && !selectedDay ? 'bg-white shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
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

              <Button variant="outline" size="sm" onClick={() => setCalendarOpen((o) => !o)}>
                <CalendarDays className="size-4 mr-1" />
                Calendrier
              </Button>
            </div>
          </CardHeader>

          <CardContent>
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
                      const isSelected = selectedDay === key;
                      const isToday = sameDay(d, new Date());
                      return (
                        <button
                          key={key}
                          onClick={() => pickDay(key)}
                          className={`flex flex-col items-center gap-1 rounded-lg py-2.5 text-xs transition-colors ${
                            isSelected ? 'bg-primary text-primary-foreground'
                              : isToday ? 'bg-muted font-medium ring-1 ring-primary/40'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <span className="uppercase text-[10px] opacity-70">{DAYS_FR_SHORT[(d.getDay() + 6) % 7]}</span>
                          <span className="text-sm font-semibold">{d.getDate()}</span>
                        </button>
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
                      {monthGrid.map((cell) => {
                        const isSelected = selectedDay === cell.key;
                        return (
                          <button
                            key={cell.key}
                            disabled={!cell.inCurrentMonth}
                            onClick={() => pickDay(cell.key)}
                            className={`aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition-colors ${
                              !cell.inCurrentMonth ? 'text-muted-foreground/30 cursor-default'
                                : isSelected ? 'bg-primary text-primary-foreground'
                                : cell.isToday ? 'bg-muted font-medium ring-1 ring-primary/40'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <span>{cell.date.getDate()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {period === 'year' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {MONTHS_FR.map((m, i) => (
                      <button
                        key={m}
                        onClick={() => { setSelectedDay(''); setAnchor(new Date(anchor.getFullYear(), i, 1)); setPeriod('month'); }}
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
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-destructive border rounded-lg bg-destructive/10">{error}</div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <PackageSearch className="size-10 stroke-1" />
                <p className="text-base font-medium">Aucune donnée trouvée</p>
                <p className="text-xs text-center max-w-sm">
                  Aucune vente enregistrée pour cette période ou sous le critère recherché.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {filteredGroups.map((group) => {
                  const cashierTotals = (group.products || []).reduce(
                    (acc, item) => ({
                      qtySold: acc.qtySold + (item.quantitySold || 0),
                      amountSold: acc.amountSold + (item.amountSold || 0),
                    }),
                    { qtySold: 0, amountSold: 0 }
                  );

                  const isUnassigned = group.userId === 'unassigned';

                  return (
                    <div key={group.userId} className="border rounded-xl bg-white shadow-sm overflow-hidden">
                      <div className="px-5 py-4 bg-gray-50/80 border-b flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${
                            isUnassigned ? 'bg-amber-100 text-amber-700' : 'bg-primary/10 text-primary'
                          }`}>
                            {isUnassigned ? <HelpCircle className="size-5" /> : (group.userName?.charAt(0).toUpperCase() || 'U')}
                          </div>
                          <div>
                            <h3 className="font-semibold text-base text-gray-900 flex items-center gap-2">
                              {group.userName}
                              {isUnassigned && (
                                <span className="text-[10px] font-normal bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                  Non attribué
                                </span>
                              )}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                              {group.products.length} opération{group.products.length > 1 ? 's' : ''} affichée{group.products.length > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-medium">
                          <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-md border border-emerald-200">
                            Total Vendu : <span className="font-bold text-sm ml-1">{formatCurrency(cashierTotals.amountSold)}</span>
                          </div>
                          <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md border border-blue-200">
                            Quantité : <span className="font-bold text-sm ml-1">{cashierTotals.qtySold} unités</span>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground bg-gray-50/50 border-b">
                              <th className="px-5 py-3 font-semibold">Caissier</th>
                              <th className="px-5 py-3 font-semibold">N° Reçu</th>
                              <th className="px-5 py-3 font-semibold">Produit</th>
                              <th className="px-5 py-3 text-right font-semibold">Quantité vendue</th>
                              <th className="px-5 py-3 text-right font-semibold">Somme vendue</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {group.products.map((item, idx) => {
                              return (
                                <tr key={`${group.userId}-${item.productId}-${idx}`} className="hover:bg-gray-50/60 transition-colors">
                                  <td className="px-5 py-3 font-medium text-xs text-gray-600">
                                    <span className="inline-flex items-center gap-1.5">
                                      <User className="size-3.5 text-muted-foreground" />
                                      {group.userName}
                                    </span>
                                  </td>

                                  <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-700">
                                    <span className="inline-flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded border">
                                      <FileText className="size-3 text-muted-foreground" />
                                      {item.receiptNumber || 'N/A'}
                                    </span>
                                  </td>

                                  <td className="px-5 py-3 font-medium text-gray-900">
                                    {item.productName}
                                  </td>

                                  <td className="px-5 py-3 text-right font-semibold text-gray-700">
                                    {item.quantitySold}
                                  </td>

                                  <td className="px-5 py-3 text-right font-semibold text-emerald-600">
                                    {formatCurrency(item.amountSold)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>

                          <tfoot>
                            <tr className="bg-gray-100/70 font-bold text-gray-900 border-t">
                              <td colSpan={3} className="px-5 py-3">Total {group.userName}</td>
                              <td className="px-5 py-3 text-right text-blue-700">{cashierTotals.qtySold}</td>
                              <td className="px-5 py-3 text-right text-emerald-700">{formatCurrency(cashierTotals.amountSold)}</td>
                            </tr>
                          </tfoot>
                        </table>
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