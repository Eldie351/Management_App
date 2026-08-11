'use client'
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { DollarSign, Box, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfYear, endOfYear, addWeeks, addMonths, addYears
} from 'date-fns';

type KPIResponse = {
  totalRevenue: number;
  inventoryValue: number;
  currency: string; // e.g. "EUR", "USD" -> used to format money
};

type SalesPoint = {
  date: string; // YYYY-MM-DD or month label
  amount: number;
  count?: number;
};

type SaleDetail = {
  id: string;
  productName: string;
  quantity: number;
  time: string; // ISO time
  amount: number;
};

type StorePerf = {
  storeId: string;
  storeName: string;
  salesAmount: number;
};

type Period = 'week' | 'month' | 'year';

const COLORS = ['#4F46E5', '#06B6D4', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6'];

export default function ReportsStats() {
  const router = useRouter();

  // UI state
  const [period, setPeriod] = useState<Period>('week');
  const [viewDate, setViewDate] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [kpis, setKpis] = useState<KPIResponse | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);

  const [salesSeries, setSalesSeries] = useState<SalesPoint[] | null>(null);
  const [salesLoading, setSalesLoading] = useState(false);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<SaleDetail[] | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const [storesPerf, setStoresPerf] = useState<StorePerf[] | null>(null);
  const [storesLoading, setStoresLoading] = useState(false);

  // compute start/end for API based on period & viewDate
  const { startISO, endISO, label } = useMemo(() => {
    let start: Date, end: Date;
    if (period === 'week') {
      start = startOfWeek(viewDate, { weekStartsOn: 1 });
      end = endOfWeek(viewDate, { weekStartsOn: 1 });
    } else if (period === 'month') {
      start = startOfMonth(viewDate);
      end = endOfMonth(viewDate);
    } else {
      start = startOfYear(viewDate);
      end = endOfYear(viewDate);
    }
    return {
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      label: `${format(start, 'yyyy-MM-dd')} → ${format(end, 'yyyy-MM-dd')}`,
    };
  }, [period, viewDate]);

  // currency formatter using the currency from KPI response (fallback EUR)
  function formatCurrency(amount: number) {
    const currencyCode = kpis?.currency ?? 'EUR';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount);
    } catch {
      return `${amount.toFixed(2)} ${currencyCode}`;
    }
  }

  // Fetch KPIs
  useEffect(() => {
    let canceled = false;
    async function load() {
      setKpisLoading(true);
      try {
        const res = await axios.get<KPIResponse>('/api/reports/kpis', {
          params: { start: startISO, end: endISO },
        });
        if (!canceled) setKpis(res.data);
      } catch (err) {
        console.error('Failed to load KPIs', err);
        if (!canceled) setKpis(null);
      } finally {
        if (!canceled) setKpisLoading(false);
      }
    }
    load();
    return () => { canceled = true; };
  }, [startISO, endISO]);

  // Fetch sales series
  useEffect(() => {
    let canceled = false;
    async function load() {
      setSalesLoading(true);
      try {
        const res = await axios.get<SalesPoint[]>('/api/reports/sales/series', {
          params: { period, start: startISO, end: endISO },
        });
        if (!canceled) setSalesSeries(res.data);
      } catch (err) {
        console.error('Failed to load sales series', err);
        if (!canceled) setSalesSeries(null);
      } finally {
        if (!canceled) setSalesLoading(false);
      }
    }
    load();
    return () => { canceled = true; };
  }, [period, startISO, endISO]);

  // Fetch stores performance
  useEffect(() => {
    let canceled = false;
    async function load() {
      setStoresLoading(true);
      try {
        const res = await axios.get<StorePerf[]>('/api/reports/stores', {
          params: { start: startISO, end: endISO },
        });
        if (!canceled) setStoresPerf(res.data);
      } catch (err) {
        console.error('Failed to load stores perf', err);
        if (!canceled) setStoresPerf(null);
      } finally {
        if (!canceled) setStoresLoading(false);
      }
    }
    load();
    return () => { canceled = true; };
  }, [startISO, endISO]);

  // Fetch day details when selectedDay changes
  useEffect(() => {
    if (!selectedDay) {
      setDayDetails(null);
      return;
    }
    let canceled = false;
    async function load() {
      setDayLoading(true);
      try {
        const res = await axios.get<SaleDetail[]>('/api/reports/sales/day', { params: { date: selectedDay } });
        if (!canceled) setDayDetails(res.data);
      } catch (err) {
        console.error('Failed to load day details', err);
        if (!canceled) setDayDetails([]);
      } finally {
        if (!canceled) setDayLoading(false);
      }
    }
    load();
    return () => { canceled = true; };
  }, [selectedDay]);

  // navigation helpers
  function shift(delta: number) {
    if (period === 'week') setViewDate(d => addWeeks(d, delta));
    if (period === 'month') setViewDate(d => addMonths(d, delta));
    if (period === 'year') setViewDate(d => addYears(d, delta));
  }
  function shiftBack() { shift(-1); }
  function shiftForward() { shift(1); }
  function goToToday() { setViewDate(() => {
    if (period === 'week') return startOfWeek(new Date(), { weekStartsOn: 1 });
    if (period === 'month') return startOfMonth(new Date());
    return startOfYear(new Date());
  }); }

  return (
    <div className="p-6 space-y-6">
      {/* Header KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-4 flex items-center">
          <div className="p-3 rounded-full bg-indigo-50 text-indigo-600 mr-4"><DollarSign /></div>
          <div className="flex-1">
            <div className="text-sm text-slate-500">Chiffre d'Affaires Réel</div>
            {kpisLoading ? (
              <div className="text-2xl font-semibold text-slate-900"><Loader className="animate-spin inline" /></div>
            ) : kpis ? (
              <div className="text-2xl font-semibold">{formatCurrency(kpis.totalRevenue)}</div>
            ) : (
              <div className="text-sm text-slate-400">—</div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-4 flex items-center">
          <div className="p-3 rounded-full bg-emerald-50 text-emerald-600 mr-4"><Box /></div>
          <div className="flex-1">
            <div className="text-sm text-slate-500">Valeur d'Inventaire</div>
            {kpisLoading ? (
              <div className="text-2xl font-semibold text-slate-900"><Loader className="animate-spin inline" /></div>
            ) : kpis ? (
              <div className="text-2xl font-semibold">{formatCurrency(kpis.inventoryValue)}</div>
            ) : (
              <div className="text-sm text-slate-400">—</div>
            )}
          </div>
        </div>
      </div>

      {/* Period selector and navigation */}
      <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="text-sm text-slate-500 mr-2">Période</div>
            <div className="flex bg-slate-100 rounded-md overflow-hidden">
              <button className={`px-3 py-1 ${period === 'week' ? 'bg-white text-slate-900' : 'text-slate-600'}`} onClick={() => setPeriod('week')}>Semaine</button>
              <button className={`px-3 py-1 ${period === 'month' ? 'bg-white text-slate-900' : 'text-slate-600'}`} onClick={() => setPeriod('month')}>Mois</button>
              <button className={`px-3 py-1 ${period === 'year' ? 'bg-white text-slate-900' : 'text-slate-600'}`} onClick={() => setPeriod('year')}>Année</button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-sm text-slate-500 hidden md:block">{label}</div>
            <div className="flex items-center gap-2">
              <button className="px-2 py-1 bg-slate-100 rounded" onClick={shiftBack}>◀</button>
              <button className="px-2 py-1 bg-slate-100 rounded" onClick={goToToday}>Aujourd'hui</button>
              <button className="px-2 py-1 bg-slate-100 rounded" onClick={shiftForward}>▶</button>
            </div>
          </div>
        </div>

        {/* Sales histogram */}
        <div className="w-full h-64">
          {salesLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400">
              <Loader className="animate-spin" />
            </div>
          ) : salesSeries && salesSeries.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesSeries} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v as number) >= 1000 ? (v as number) / 1000 + 'k' : v}`} />
                <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                <Bar dataKey="amount" fill="#4F46E5" onClick={(d: any) => {
                  if (d && d.payload && d.payload.date) {
                    setSelectedDay(d.payload.date as string);
                    // scroll to details panel
                    setTimeout(() => {
                      const el = document.querySelector('#day-detail-panel');
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }, 150);
                  }
                }} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">Aucune donnée disponible pour la période sélectionnée.</div>
          )}
        </div>

        {/* Day detail panel */}
        <div id="day-detail-panel" className="mt-4">
          {selectedDay ? (
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm text-slate-500">Détails de la journée</div>
                  <div className="font-medium">{selectedDay}</div>
                </div>
                <div>
                  <button className="text-sm text-slate-500" onClick={() => setSelectedDay(null)}>Fermer</button>
                </div>
              </div>

              {dayLoading ? (
                <div className="py-8 flex justify-center"><Loader className="animate-spin" /></div>
              ) : dayDetails && dayDetails.length > 0 ? (
                <div className="space-y-3">
                  {dayDetails.map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded">
                      <div>
                        <div className="font-medium">{s.productName}</div>
                        <div className="text-xs text-slate-400">{format(new Date(s.time), 'HH:mm')}</div>
                      </div>
                      <div className="text-right">
                        <div>{s.quantity} ×</div>
                        <div className="font-medium">{formatCurrency(s.amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">Aucune vente enregistrée ce jour.</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Stores performance donut */}
      <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-lg font-medium">Performance des magasins</div>
          <div className="text-sm text-slate-500">{label}</div>
        </div>

        <div className="w-full h-64 flex items-center justify-center">
          {storesLoading ? (
            <Loader className="animate-spin text-slate-400" />
          ) : storesPerf && storesPerf.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={storesPerf}
                  dataKey="salesAmount"
                  nameKey="storeName"
                  outerRadius={80}
                  innerRadius={40}
                  paddingAngle={2}
                  onClick={(entry) => {
                    if (entry && (entry as any).payload) {
                      const storeId = (entry as any).payload.storeId;
                      router.push(`/stores/${storeId}/stats`);
                    }
                  }}
                >
                  {storesPerf.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: any, name: any, props: any) => {
                  const p = props.payload as StorePerf;
                  const sum = storesPerf!.reduce((s, it) => s + it.salesAmount, 0);
                  const percent = ((p.salesAmount / sum) * 100).toFixed(1);
                  return [`${formatCurrency(Number(p.salesAmount))} (${percent}%)`, p.storeName];
                }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-slate-400">Aucune donnée de magasins disponible.</div>
          )}
        </div>
      </div>
    </div>
  );
}
