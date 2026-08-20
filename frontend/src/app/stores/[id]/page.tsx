'use client';

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import DashboardCard from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  ArrowLeft,
  DollarSign,
  Boxes,
  Receipt,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PackageSearch,
  X,
} from 'lucide-react';
import { getStoredUserRole } from '@/lib/auth';

// Recharts est importé statiquement ; le rendu du graphique est différé au montage
// côté client (voir `mounted` plus bas) pour éviter tout écart serveur/client.
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ----------------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------------
type Period = 'week' | 'month' | 'year';

interface Kpis {
  totalRevenue: number;
  inventoryValue: number;
  currency: string;
}

interface SalesPoint {
  date: string;
  label: string;
  amount: number;
  count?: number;
}

interface SaleDetail {
  id: string;
  productName: string;
  quantity: number;
  time: string;
  amount: number;
}

interface StoreInfo {
  id: number;
  name: string;
  location?: string | null;
  currency?: string;
}

interface FullSaleItem {
  id: number | string;
  quantity: number;
  unitPrice?: number;
  total: number;
  product?: { name?: string } | null;
}

interface FullSale {
  id: number | string;
  invoiceNumber?: string;
  totalAmount: number;
  paymentMethod?: string;
  createdAt: string;
  user?: { id?: number; name?: string } | null;
  items?: FullSaleItem[];
}

// ----------------------------------------------------------------------------------
// Helpers de date (identiques à /stats, sans dépendance externe)
// ----------------------------------------------------------------------------------
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const MONTHS_FR_SHORT = MONTHS_FR.map((m) => m.slice(0, 3));
const DAYS_FR_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Espèces',
  CARD: 'Carte',
  MOBILE_MONEY: 'Mobile Money',
  TRANSFER: 'Virement',
};

function pad(n: number) {
  return n.toString().padStart(2, '0');
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

// ----------------------------------------------------------------------------------
// Composant
// ----------------------------------------------------------------------------------
function StoreDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const storeId = Number(params?.id);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const initialPeriod = (searchParams.get('period') as Period) || 'week';
  const initialAnchorParam = searchParams.get('anchor');
  const initialAnchor = initialAnchorParam && !Number.isNaN(new Date(initialAnchorParam).getTime())
    ? new Date(initialAnchorParam)
    : new Date();

  const [period, setPeriod] = useState<Period>(['week', 'month', 'year'].includes(initialPeriod) ? initialPeriod : 'week');
  const [anchor, setAnchor] = useState<Date>(initialAnchor);

  const [store, setStore] = useState<StoreInfo | null>(null);
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  const [salesSeries, setSalesSeries] = useState<SalesPoint[] | null>(null);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedDayLabel, setSelectedDayLabel] = useState<string>('');
  const [dayDetails, setDayDetails] = useState<SaleDetail[] | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const [fullSales, setFullSales] = useState<FullSale[] | null>(null);
  const [fullSalesLoading, setFullSalesLoading] = useState(true);
  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  // Le graphique Recharts n'est rendu qu'une fois monté côté client.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { start, end, label } = useMemo(() => {
    let s: Date, e: Date;
    if (period === 'week') { s = startOfWeek(anchor); e = endOfWeek(anchor); }
    else if (period === 'month') { s = startOfMonth(anchor); e = endOfMonth(anchor); }
    else { s = startOfYear(anchor); e = endOfYear(anchor); }
    return { start: s, end: e, label: rangeLabel(period, s, e) };
  }, [period, anchor]);

  const formatCurrency = useMemo(() => currencyFormatter(kpis?.currency ?? store?.currency ?? 'XOF'), [kpis?.currency, store?.currency]);

  // Contrôle d'accès (ADMIN / MANAGER uniquement)
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/login'); return; }
    const role = getStoredUserRole();
    if (role === 'CASHIER') { router.push('/dashboard'); return; }
    setCheckingAccess(false);
  }, [router]);

  const authedFetch = useCallback(async (path: string) => {
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      localStorage.removeItem('access_token');
      router.push('/login');
      return null;
    }
    if (!res.ok) {
      let message = `Erreur ${res.status}`;
      try {
        const errorData = await res.json();
        if (errorData?.message) {
          message = Array.isArray(errorData.message) ? errorData.message.join(', ') : errorData.message;
        }
      } catch {
        message = `Erreur HTTP ${res.status} (${res.statusText || 'Requête échouée'}) sur ${path}`;
      }
      throw new Error(message);
    }
    return res.json();
  }, [API, router]);

  // Infos du magasin
  useEffect(() => {
    if (checkingAccess || !storeId) return;
    let canceled = false;
    (async () => {
      try {
        const data = await authedFetch(`/stores/${storeId}`);
        if (!canceled && data) {
          setStore({ id: data.id, name: data.name, location: data.location, currency: data.currency });
        }
      } catch (err: any) {
        if (!canceled) setAccessError(err?.message || "Impossible de charger ce magasin.");
      }
    })();
    return () => { canceled = true; };
  }, [checkingAccess, storeId, authedFetch]);

  // KPIs du magasin sur la période
  useEffect(() => {
    if (checkingAccess || !storeId) return;
    let canceled = false;
    (async () => {
      setKpisLoading(true);
      try {
        const data = await authedFetch(`/reports/kpis?start=${start.toISOString()}&end=${end.toISOString()}&storeId=${storeId}`);
        if (!canceled && data) {
          setKpis({
            totalRevenue: Number(data.totalRevenue ?? 0),
            inventoryValue: Number(data.inventoryValue ?? 0),
            currency: data.currency ?? 'XOF',
          });
        }
      } catch (err) {
        console.error('Erreur chargement KPIs magasin', err);
        if (!canceled) setKpis(null);
      } finally {
        if (!canceled) setKpisLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [checkingAccess, storeId, start, end, authedFetch]);

  // Historique des ventes (pour l'histogramme)
  useEffect(() => {
    if (checkingAccess || !storeId) return;
    let canceled = false;
    (async () => {
      setSalesLoading(true);
      setSalesError(null);
      try {
        const data = await authedFetch(
          `/reports/sales-series?period=${period}&start=${start.toISOString()}&end=${end.toISOString()}&storeId=${storeId}`,
        );
        if (canceled || !data) return;
        const rows = Array.isArray(data) ? data : (data.data ?? []);
        const points: SalesPoint[] = rows.map((row: any) => {
          const dateKey = row.date ?? row.bucket ?? row.label ?? '';
          let displayLabel = dateKey;
          if (period === 'week' && dateKey) {
            const d = new Date(dateKey);
            if (!Number.isNaN(d.getTime())) displayLabel = DAYS_FR_SHORT[(d.getDay() + 6) % 7];
          } else if (period === 'month' && dateKey) {
            const d = new Date(dateKey);
            if (!Number.isNaN(d.getTime())) displayLabel = String(d.getDate());
          } else if (period === 'year' && dateKey) {
            const monthIndex = /^\d{4}-\d{2}/.test(dateKey) ? Number(dateKey.slice(5, 7)) - 1 : new Date(dateKey).getMonth();
            displayLabel = MONTHS_FR_SHORT[monthIndex] ?? dateKey;
          }
          return {
            date: dateKey,
            label: displayLabel,
            amount: Number(row.amount ?? row.totalAmount ?? row.total ?? 0),
            count: row.count != null ? Number(row.count) : undefined,
          };
        });
        setSalesSeries(points);
      } catch (err: any) {
        console.error('Erreur chargement historique des ventes', err);
        if (!canceled) {
          setSalesSeries(null);
          setSalesError(err?.message || "Impossible de charger l'historique des ventes.");
        }
      } finally {
        if (!canceled) setSalesLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [checkingAccess, storeId, period, start, end, authedFetch]);

  // Détail complet des ventes du magasin (facture par facture), filtré côté client sur la période choisie
  useEffect(() => {
    if (checkingAccess || !storeId) return;
    let canceled = false;
    (async () => {
      setFullSalesLoading(true);
      try {
        const data = await authedFetch(`/sales/store/${storeId}`);
        if (!canceled && data) {
          const rows: FullSale[] = Array.isArray(data) ? data : (data?.data ?? []);
          setFullSales(rows);
        }
      } catch (err) {
        console.error('Erreur chargement du détail des ventes', err);
        if (!canceled) setFullSales(null);
      } finally {
        if (!canceled) setFullSalesLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [checkingAccess, storeId, authedFetch]);

  useEffect(() => {
    setSelectedDay(null);
    setDayDetails(null);
    setExpandedSaleId(null);
  }, [period, start, end]);

  const openDayDetails = useCallback(async (dateKey: string, displayLabel: string) => {
    setSelectedDay(dateKey);
    setSelectedDayLabel(displayLabel);
    setDayLoading(true);
    try {
      const data = await authedFetch(`/reports/sales/day?date=${encodeURIComponent(dateKey)}&storeId=${storeId}`);
      if (data) {
        const rows = Array.isArray(data) ? data : (data?.data ?? []);
        setDayDetails(rows.map((row: any) => ({
          id: row.id,
          productName: row.productName ?? row.product_name ?? 'Produit',
          quantity: Number(row.quantity ?? 0),
          time: row.time ?? row.createdAt ?? row.created_at,
          amount: Number(row.amount ?? row.total ?? 0),
        })));
      }
    } catch (err) {
      console.error('Erreur chargement détails du jour', err);
      setDayDetails([]);
    } finally {
      setDayLoading(false);
      setTimeout(() => {
        document.getElementById('day-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [storeId, authedFetch]);

  function goPrev() { setAnchor((d) => shiftPeriod(d, period, -1)); }
  function goNext() { setAnchor((d) => shiftPeriod(d, period, 1)); }
  function goToday() { setAnchor(new Date()); setPeriod('week'); }

  // Ventes filtrées sur la plage de dates actuellement sélectionnée (week/month/year)
  const filteredSales = useMemo(() => {
    if (!fullSales) return null;
    return fullSales
      .filter((s) => {
        const t = new Date(s.createdAt).getTime();
        return t >= start.getTime() && t <= end.getTime();
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [fullSales, start, end]);

  if (checkingAccess) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Vérification de l'accès…
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8">
          <Button variant="outline" size="sm" onClick={() => router.push('/stats')} className="mb-4 gap-1">
            <ArrowLeft className="size-4" /> Retour aux rapports
          </Button>
          <div className="rounded-lg border bg-white p-6 text-sm text-destructive">{accessError}</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="border-b pb-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/stats')} className="mb-2 -ml-2 gap-1 text-muted-foreground">
              <ArrowLeft className="size-4" /> Retour aux rapports
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{store?.name ?? `Magasin #${storeId}`}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Historique et détail complet des ventes{store?.location ? ` — ${store.location}` : ''}
            </p>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <DashboardCard
            title="Chiffre d'Affaires"
            value={kpis ? formatCurrency(kpis.totalRevenue) : '—'}
            description={`Ventes réalisées — ${label}`}
            icon={DollarSign}
            loading={kpisLoading}
          />
          <DashboardCard
            title="Valeur d'Inventaire"
            value={kpis ? formatCurrency(kpis.inventoryValue) : '—'}
            description="Stock courant de ce magasin"
            icon={Boxes}
            loading={kpisLoading}
          />
          <DashboardCard
            title="Ventes enregistrées"
            value={filteredSales ? filteredSales.length : '—'}
            description={`Factures — ${label}`}
            icon={Receipt}
            loading={fullSalesLoading}
          />
        </div>

        {/* Historique des ventes */}
        <Card className="mb-6">
          <CardHeader className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Historique des ventes</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{label}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
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
            </div>
          </CardHeader>

          <CardContent>
            <div className="w-full h-72">
              {salesLoading || !mounted ? (
                <Skeleton className="h-full w-full" />
              ) : salesError ? (
                <div className="h-full flex items-center justify-center text-sm text-destructive">{salesError}</div>
              ) : salesSeries && salesSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesSeries} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(37, 99, 235, 0.08)' }}
                      formatter={(value: any) => [formatCurrency(Number(value)), 'Ventes']}
                    />
                    <Bar
                      dataKey="amount"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(point: any) => {
                        const p = point?.payload;
                        if (!p?.date) return;
                        if (period === 'year') {
                          const [y, m] = p.date.split('-').map(Number);
                          setAnchor(new Date(y, (m ?? 1) - 1, 1));
                          setPeriod('month');
                        } else {
                          openDayDetails(p.date, p.label);
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <PackageSearch className="size-8" />
                  <p className="text-sm">Aucune donnée disponible pour la période sélectionnée.</p>
                </div>
              )}
            </div>

            {selectedDay && (
              <div id="day-detail-panel" className="mt-6 border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Détail des ventes</p>
                    <p className="font-medium">{selectedDayLabel || selectedDay}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedDay(null)}>
                    <X className="size-4" />
                  </Button>
                </div>

                {dayLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : dayDetails && dayDetails.length > 0 ? (
                  <div className="space-y-2">
                    {dayDetails.map((s) => (
                      <div key={s.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                        <div>
                          <p className="font-medium text-sm">{s.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.time ? new Date(s.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Qté: {s.quantity}</p>
                          <p className="font-medium text-sm">{formatCurrency(s.amount)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-sm text-muted-foreground">Aucune vente enregistrée ce jour-là.</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Détail complet des ventes (facture par facture) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Détail complet des ventes</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Toutes les factures de ce magasin — {label}</p>
          </CardHeader>
          <CardContent>
            {fullSalesLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredSales && filteredSales.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Facture</TableHead>
                    <TableHead>Date & Heure</TableHead>
                    <TableHead>Caissier</TableHead>
                    <TableHead>Paiement</TableHead>
                    <TableHead className="text-right">Articles</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((s) => {
                    const key = String(s.id);
                    const isOpen = expandedSaleId === key;
                    const itemCount = s.items?.reduce((sum, it) => sum + Number(it.quantity || 0), 0) ?? 0;
                    return (
                      <Fragment key={key}>
                        <TableRow
                          className="cursor-pointer"
                          onClick={() => setExpandedSaleId(isOpen ? null : key)}
                        >
                          <TableCell>
                            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                          </TableCell>
                          <TableCell className="font-mono text-sm font-medium">{s.invoiceNumber ?? `#${s.id}`}</TableCell>
                          <TableCell className="text-sm">{new Date(s.createdAt).toLocaleString('fr-FR')}</TableCell>
                          <TableCell className="text-sm">{s.user?.name ?? '—'}</TableCell>
                          <TableCell className="text-sm">{PAYMENT_LABELS[s.paymentMethod ?? ''] ?? s.paymentMethod ?? '—'}</TableCell>
                          <TableCell className="text-right text-sm">{itemCount}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(Number(s.totalAmount))}</TableCell>
                        </TableRow>
                        {isOpen && s.items && s.items.length > 0 && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell />
                            <TableCell colSpan={6}>
                              <div className="py-2 space-y-1.5">
                                {s.items.map((it) => (
                                  <div key={it.id} className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      {it.product?.name ?? 'Produit'} <span className="text-xs">× {it.quantity}</span>
                                    </span>
                                    <span className="font-medium">{formatCurrency(Number(it.total))}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Receipt className="size-8" />
                <p className="text-sm">Aucune vente enregistrée pour ce magasin sur la période sélectionnée.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function StoreDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Chargement…</div>}>
      <StoreDetailContent />
    </Suspense>
  );
}
