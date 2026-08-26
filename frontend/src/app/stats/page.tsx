'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import DashboardCard from '@/components/DashboardCard';
import { Button } from '@/components/ui/button';
import { LoadingDots } from '@/components/ui/loading_dots';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  PackageSearch,
  Store as StoreIcon,
  CircleX,
} from 'lucide-react';
import { getStoredUserRole } from '@/lib/auth';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
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
  date: string;   // clé brute renvoyée par le backend (YYYY-MM-DD ou YYYY-MM)
  label: string;  // libellé affiché sur l'axe X
  amount: number;
  count?: number;
}

interface SaleDetail {
  id: number | string;
  productName: string;
  quantity: number;
  time: string; // ISO
  amount: number;
}

interface StorePerf {
  storeId: number;
  storeName: string;
  salesAmount: number;
  salesCount?: number;
}

interface StoreOption {
  id: number;
  name: string;
}

interface DayCell {
  date: Date;
  key: string;
  inCurrentMonth: boolean;
  isToday: boolean;
}

// ----------------------------------------------------------------------------------
// Constantes & helpers date
// ----------------------------------------------------------------------------------
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const MONTHS_FR_SHORT = MONTHS_FR.map((m) => m.slice(0, 3));
const DAYS_FR_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

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
  const day = (date.getDay() + 6) % 7; // Lundi = 0
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
// Composant principal
// ----------------------------------------------------------------------------------
export default function StatsPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [checkingAccess, setCheckingAccess] = useState(true);

  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  const [salesSeries, setSalesSeries] = useState<SalesPoint[] | null>(null);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesError, setSalesError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedDayLabel, setSelectedDayLabel] = useState<string>('');
  const [dayDetails, setDayDetails] = useState<SaleDetail[] | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const [storesPerf, setStoresPerf] = useState<StorePerf[] | null>(null);
  const [storesLoading, setStoresLoading] = useState(true);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { start, end, label } = useMemo(() => {
    let s: Date, e: Date;
    if (period === 'week') { s = startOfWeek(anchor); e = endOfWeek(anchor); }
    else if (period === 'month') { s = startOfMonth(anchor); e = endOfMonth(anchor); }
    else { s = startOfYear(anchor); e = endOfYear(anchor); }
    return { start: s, end: e, label: rangeLabel(period, s, e) };
  }, [period, anchor]);

  const formatCurrency = useMemo(() => currencyFormatter(kpis?.currency ?? 'XOF'), [kpis?.currency]);

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

  useEffect(() => {
    if (checkingAccess) return;
    (async () => {
      try {
        const data = await authedFetch('/stores');
        if (!data) return;
        const list = Array.isArray(data) ? data : (data.data ?? []);
        setStoreOptions(list.map((s: any) => ({ id: s.id, name: s.name })));
      } catch (err) {
        console.error('Impossible de charger la liste des magasins', err);
      }
    })();
  }, [checkingAccess, authedFetch]);

  useEffect(() => {
    if (checkingAccess) return;
    let canceled = false;
    (async () => {
      setKpisLoading(true);
      try {
        const storeParam = storeFilter ? `&storeId=${storeFilter}` : '';
        const data = await authedFetch(`/reports/kpis?start=${start.toISOString()}&end=${end.toISOString()}${storeParam}`);
        if (!canceled && data) {
          setKpis({
            totalRevenue: Number(data.totalRevenue ?? 0),
            inventoryValue: Number(data.inventoryValue ?? 0),
            currency: data.currency ?? 'XOF',
          });
        }
      } catch (err) {
        console.error('Erreur chargement KPIs', err);
        if (!canceled) setKpis(null);
      } finally {
        if (!canceled) setKpisLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [checkingAccess, start, end, storeFilter, authedFetch]);

  useEffect(() => {
    if (checkingAccess) return;
    let canceled = false;
    (async () => {
      setSalesLoading(true);
      setSalesError(null);
      try {
        const storeParam = storeFilter ? `&storeId=${storeFilter}` : '';
        const data = await authedFetch(
          `/reports/sales-series?period=${period}&start=${start.toISOString()}&end=${end.toISOString()}${storeParam}`,
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
  }, [checkingAccess, period, start, end, storeFilter, authedFetch]);

  useEffect(() => {
    if (checkingAccess) return;
    let canceled = false;
    (async () => {
      setStoresLoading(true);
      try {
        const data = await authedFetch(`/reports/stores-perf?start=${start.toISOString()}&end=${end.toISOString()}`);
        if (canceled || !data) return;
        const rows = Array.isArray(data) ? data : (data.data ?? []);
        setStoresPerf(rows.map((row: any) => ({
          storeId: row.storeId ?? row.store_id ?? row.id,
          storeName: row.storeName ?? row.store_name ?? row.name ?? 'Magasin',
          salesAmount: Number(row.salesAmount ?? row.sales_amount ?? row.total ?? 0),
          salesCount: row.salesCount != null ? Number(row.salesCount) : undefined,
        })));
      } catch (err) {
        console.error('Erreur chargement performance des magasins', err);
        if (!canceled) setStoresPerf(null);
      } finally {
        if (!canceled) setStoresLoading(false);
      }
    })();
    return () => { canceled = true; };
  }, [checkingAccess, start, end, authedFetch]);

  useEffect(() => {
    setSelectedDay(null);
    setDayDetails(null);
  }, [period, start, end, storeFilter]);

  const openDayDetails = useCallback(async (dateKey: string, displayLabel: string) => {
    setCalendarOpen(false);
    setSelectedDay(dateKey);
    setSelectedDayLabel(displayLabel);
    setDayLoading(true);
    try {
      const storeParam = storeFilter ? `&storeId=${storeFilter}` : '';
      const data = await authedFetch(`/reports/sales/day?date=${encodeURIComponent(dateKey)}${storeParam}`);
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
  }, [storeFilter, authedFetch]);

  function goPrev() { setAnchor((d) => shiftPeriod(d, period, -1)); }
  function goNext() { setAnchor((d) => shiftPeriod(d, period, 1)); }
  function goToday() { setAnchor(new Date()); setPeriod('week'); }

  function goToStoreDetail(id: number) {
    const params = new URLSearchParams({
      period,
      anchor: anchor.toISOString(),
    });
    router.push(`/stores/${id}?${params.toString()}`);
  }

  const totalStoreSales = useMemo(
    () => (storesPerf ?? []).reduce((sum, s) => sum + s.salesAmount, 0),
    [storesPerf],
  );

  const amountByDay = useMemo(() => {
    const map = new Map<string, number>();
    if (period === 'month' || period === 'week') {
      (salesSeries ?? []).forEach((p) => { if (p.date) map.set(p.date.slice(0, 10), p.amount); });
    }
    return map;
  }, [salesSeries, period]);

  const monthGrid = useMemo(() => buildMonthGrid(anchor), [anchor]);
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [start]);

  const activeStoreName = storeOptions.find((s) => String(s.id) === storeFilter)?.name;

  // ÉCRAN DE CHARGEMENT PLEIN ÉCRAN
  if (checkingAccess) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100">
        <LoadingDots size="h-4 w-4" color="bg-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="border-b pb-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rapports & Statistiques</h1>
            <p className="mt-1 text-sm text-gray-500">Suivi du chiffre d'affaires, de l'inventaire et des performances par magasin</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {storeFilter && (
              <button
                onClick={() => setStoreFilter('')}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                title="Réinitialiser le filtre magasin"
              >
                <CircleX className="size-3.5" /> Réinitialiser
              </button>
            )}
            <select
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
              className="px-3 py-2 text-sm border rounded-md bg-white shadow-sm min-w-[180px]"
            >
              <option value="">Tous les magasins</option>
              {storeOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 1. Cartes KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <DashboardCard
            title="Chiffre d'Affaires Réel"
            value={kpis ? formatCurrency(kpis.totalRevenue) : '—'}
            description={activeStoreName ? `Ventes réalisées — ${activeStoreName}` : 'Somme des ventes réalisées sur la période'}
            icon={DollarSign}
            loading={kpisLoading}
          />
          <DashboardCard
            title="Valeur / Volume d'Inventaire"
            value={kpis ? formatCurrency(kpis.inventoryValue) : '—'}
            description={activeStoreName ? `Stock courant — ${activeStoreName}` : 'Quantité restante × prix, stock courant'}
            icon={Boxes}
            loading={kpisLoading}
          />
        </div>

        {/* 2. Historique des ventes & calendrier */}
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
                    onClick={() => { setPeriod(p); setCalendarOpen(false); }}
                    className={`px-3 py-1.5 text-sm rounded-sm transition-colors ${
                      period === p ? 'bg-white shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : 'Année'}
                  </button>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={goToday}>Aujourd'hui</Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCalendarOpen((o) => !o)}
                aria-expanded={calendarOpen}
              >
                <CalendarDays className="size-4" />
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
                      const amount = amountByDay.get(key);
                      const isSelected = selectedDay === key;
                      const isToday = sameDay(d, new Date());
                      return (
                        <button
                          key={key}
                          onClick={() => openDayDetails(key, `${DAYS_FR_SHORT[(d.getDay() + 6) % 7]} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`)}
                          className={`flex flex-col items-center gap-1 rounded-lg py-2.5 text-xs transition-colors ${
                            isSelected ? 'bg-primary text-primary-foreground'
                              : isToday ? 'bg-muted font-medium ring-1 ring-primary/40'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <span className="uppercase text-[10px] opacity-70">{DAYS_FR_SHORT[(d.getDay() + 6) % 7]}</span>
                          <span className="text-sm font-semibold">{d.getDate()}</span>
                          <span className={`size-1.5 rounded-full ${amount ? (isSelected ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent'}`} />
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
                        const amount = amountByDay.get(cell.key);
                        const isSelected = selectedDay === cell.key;
                        return (
                          <button
                            key={cell.key}
                            disabled={!cell.inCurrentMonth}
                            onClick={() => openDayDetails(cell.key, `${pad(cell.date.getDate())}/${pad(cell.date.getMonth() + 1)}/${cell.date.getFullYear()}`)}
                            className={`aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg text-xs transition-colors ${
                              !cell.inCurrentMonth ? 'text-muted-foreground/30 cursor-default'
                                : isSelected ? 'bg-primary text-primary-foreground'
                                : cell.isToday ? 'bg-muted font-medium ring-1 ring-primary/40'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <span>{cell.date.getDate()}</span>
                            {cell.inCurrentMonth && (
                              <span className={`size-1 rounded-full ${amount ? (isSelected ? 'bg-primary-foreground' : 'bg-primary') : 'bg-transparent'}`} />
                            )}
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

        {/* 3. Performance des magasins */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Performance des magasins</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Cliquez sur un magasin pour voir son historique détaillé</p>
            </div>
            <p className="text-sm text-muted-foreground">{label}</p>
          </CardHeader>
          <CardContent>
            {storesLoading || !mounted ? (
              <div className="h-72 flex items-center justify-center">
                <Skeleton className="h-56 w-56 rounded-full" />
              </div>
            ) : storesPerf && storesPerf.length > 0 ? (
              <div className="flex flex-col lg:flex-row items-center gap-6">
                <div className="relative w-full lg:w-1/2 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={storesPerf}
                        dataKey="salesAmount"
                        nameKey="storeName"
                        innerRadius={68}
                        outerRadius={104}
                        paddingAngle={3}
                        cornerRadius={6}
                        cursor="pointer"
                        onClick={(entry: any) => {
                          const storeId = entry?.payload?.storeId;
                          if (storeId) goToStoreDetail(storeId);
                        }}
                      >
                        {storesPerf.map((entry, index) => (
                          <Cell
                            key={entry.storeId}
                            fill={COLORS[index % COLORS.length]}
                            stroke="#fff"
                            strokeWidth={2}
                            className="transition-opacity hover:opacity-80"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, _name: any, props: any) => {
                          const pct = totalStoreSales > 0 ? ((Number(value) / totalStoreSales) * 100).toFixed(1) : '0';
                          return [`${formatCurrency(Number(value))} (${pct}%)`, props?.payload?.storeName];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="text-sm font-bold">{formatCurrency(totalStoreSales)}</span>
                  </div>
                </div>

                <div className="w-full lg:w-1/2 space-y-3">
                  {storesPerf.map((store, index) => {
                    const pct = totalStoreSales > 0 ? ((store.salesAmount / totalStoreSales) * 100).toFixed(1) : '0';
                    return (
                      <div
                        key={store.storeId}
                        onClick={() => goToStoreDetail(store.storeId)}
                        className="flex items-center justify-between p-3 rounded-lg bg-white border shadow-sm hover:border-primary cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="size-3 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div>
                            <p className="font-medium text-sm">{store.storeName}</p>
                            <p className="text-xs text-muted-foreground">{pct}% des ventes</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">{formatCurrency(store.salesAmount)}</p>
                          {store.salesCount != null && (
                            <p className="text-xs text-muted-foreground">{store.salesCount} vente(s)</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <StoreIcon className="size-8" />
                <p className="text-sm">Aucune donnée de magasin pour cette période.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}