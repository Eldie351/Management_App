'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Menu from '../../components/Menu';

// Recharts dynamic imports to avoid SSR issues
const BarChart = dynamic(() => import('recharts').then(mod => mod.BarChart), { ssr: false });
const Bar = dynamic(() => import('recharts').then(mod => mod.Bar), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(mod => mod.XAxis), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(mod => mod.YAxis), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(mod => mod.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(mod => mod.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import('recharts').then(mod => mod.PieChart), { ssr: false });
const Pie = dynamic(() => import('recharts').then(mod => mod.Pie), { ssr: false });
const Cell = dynamic(() => import('recharts').then(mod => mod.Cell), { ssr: false });

function getStartOfWeek(d: Date) {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // make Monday = 0
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}
function getEndOfWeek(d: Date) {
  const s = getStartOfWeek(d);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

async function safeFetchJson(url: string) {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (e) {
      // sometimes already JSON, fallback to res.json()
      try {
        return await res.json();
      } catch (e2) {
        return null;
      }
    }
  } catch (e) {
    return null;
  }
}

export default function Page() {
  const router = useRouter();
  const [period, setPeriod] = useState<'week'|'month'|'year'>('week');
  const [startDate, setStartDate] = useState<Date>(() => getStartOfWeek(new Date()));
  const [endDate, setEndDate] = useState<Date>(() => getEndOfWeek(new Date()));

  const [kpis, setKpis] = useState<any | null>(null);
  const [salesSeries, setSalesSeries] = useState<any[] | null>(null);
  const [storesPerf, setStoresPerf] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [dayDetails, setDayDetails] = useState<any[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<number | ''>('');

  // helper to format dates to ISO for backend
  const iso = (d: Date) => d.toISOString();

  useEffect(() => {
    // compute start/end from period if needed
    const now = new Date();
    if (period === 'week') {
      setStartDate(getStartOfWeek(now));
      setEndDate(getEndOfWeek(now));
    } else if (period === 'month') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      setStartDate(s);
      setEndDate(e);
    } else {
      const s = new Date(now.getFullYear(), 0, 1);
      const e = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      setStartDate(s);
      setEndDate(e);
    }
  }, [period]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const storeParam = selectedStoreId ? `&storeId=${selectedStoreId}` : '';
        const kUrl = `/api/reports/kpis?start=${encodeURIComponent(iso(startDate))}&end=${encodeURIComponent(iso(endDate))}${storeParam}`;
        const sUrl = `/api/reports/sales/series?period=${period}&start=${encodeURIComponent(iso(startDate))}&end=${encodeURIComponent(iso(endDate))}${storeParam}`;
        const stUrl = `/api/reports/stores?start=${encodeURIComponent(iso(startDate))}&end=${encodeURIComponent(iso(endDate))}`;

        const [k, s, st] = await Promise.all([
          safeFetchJson(kUrl),
          safeFetchJson(sUrl),
          safeFetchJson(stUrl),
        ]);

        setKpis(k);
        // normalize series to array
        setSalesSeries(Array.isArray(s) ? s : (s?.data ?? []));
        setStoresPerf(Array.isArray(st) ? st : (st?.data ?? []));
      } catch (e) {
        console.error('Failed to load stats', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [period, startDate, endDate, selectedStoreId]);

  const colors = ['#60A5FA', '#34D399', '#F59E0B', '#F97316', '#EF4444'];

  const onBarClick = async (bucketDate: string) => {
    // fetch sales day details
    try {
      const storeParam = selectedStoreId ? `&storeId=${selectedStoreId}` : '';
      const res = await safeFetchJson(`/api/reports/sales/day?date=${encodeURIComponent(bucketDate)}${storeParam}`);
      setDayDetails(Array.isArray(res) ? res : (res?.data ?? []));
      setSelectedDay(bucketDate);
      const el = document.getElementById('day-details');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } catch (e) {
      console.error(e);
    }
  };

  const currencyFormat = (value: number, currency = 'EUR') => new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(value ?? 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <Menu />

      <main className="max-w-7xl mx-auto p-4">
        <h1 className="text-2xl font-semibold mb-4">Rapports & Statistiques</h1>

        {/* KPI cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            {loading && !kpis ? (
              <div className="animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-3/4 mb-3" />
                <div className="h-10 bg-slate-200 rounded w-1/2" />
              </div>
            ) : (
              <>
                <div className="text-sm text-slate-500">Chiffre d'Affaires Réel</div>
                <div className="mt-2 text-2xl font-bold">{kpis ? currencyFormat(Number(kpis.totalRevenue ?? 0), kpis.currency ?? 'EUR') : '—'}</div>
              </>
            )}
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm">
            {loading && !kpis ? (
              <div className="animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-3/4 mb-3" />
                <div className="h-10 bg-slate-200 rounded w-1/2" />
              </div>
            ) : (
              <>
                <div className="text-sm text-slate-500">Valeur / Volume d'Inventaire</div>
                <div className="mt-2 text-2xl font-bold">{kpis ? currencyFormat(Number(kpis.inventoryValue ?? 0), kpis.currency ?? 'EUR') : '—'}</div>
              </>
            )}
          </div>
        </section>

        {/* Controls: period selector and store selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Période</label>
            <select value={period} onChange={(e) => setPeriod(e.target.value as any)} className="ml-2 px-2 py-1 border rounded-md bg-white">
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="year">Année</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Magasin</label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value ? Number(e.target.value) : '')}
              className="ml-2 px-2 py-1 border rounded-md bg-white"
            >
              <option value="">Tous les magasins</option>
              {storesPerf?.map((s) => (
                <option key={s.storeId} value={s.storeId}>{s.storeName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Sales chart */}
        <section className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">Historique des ventes</h2>
            <div className="text-sm text-slate-500">Vue: {period}</div>
          </div>

          <div style={{ width: '100%', height: 320 }}>
            {loading && !salesSeries ? (
              <div className="h-72 animate-pulse bg-slate-100 rounded" />
            ) : salesSeries && salesSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesSeries} onClick={(e: any) => { if (e && e.activeLabel) onBarClick(e.activeLabel); }}>
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(v:any) => currencyFormat(Number(v ?? 0), kpis?.currency ?? 'EUR')} />
                  <Bar dataKey="amount" fill="#60A5FA" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-72 flex items-center justify-center text-slate-500">Aucune donnée disponible pour la période sélectionnée</div>
            )}
          </div>

          {/* Day details panel - shown when a bar is clicked */}
          {selectedDay && (
            <div id="day-details" className="mt-4">
              <h3 className="text-md font-semibold mb-2">Détails pour le {selectedDay}</h3>
              {dayDetails === null ? (
                <div className="text-sm text-slate-500">Chargement…</div>
              ) : dayDetails.length === 0 ? (
                <div className="text-sm text-slate-500">Aucune vente ce jour-là.</div>
              ) : (
                <div className="grid gap-2">
                  {dayDetails.map((row: any) => (
                    <div key={row.id} className="p-2 border rounded bg-white">
                      <div className="flex justify-between">
                        <div className="font-medium">{row.productName}</div>
                        <div className="text-sm text-slate-600">{currencyFormat(Number(row.amount ?? 0), kpis?.currency ?? 'EUR')}</div>
                      </div>
                      <div className="text-sm text-slate-500">Quantité: {row.quantity} — Heure: {new Date(row.time).toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Stores performance donut */}
        <section className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-semibold">Performance des magasins</h2>
            <div className="text-sm text-slate-500">Cliquez sur une part pour voir le magasin</div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div style={{ width: 320, height: 320 }}>
              {loading && !storesPerf ? (
                <div className="h-80 animate-pulse bg-slate-100 rounded" />
              ) : storesPerf && storesPerf.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie dataKey="salesAmount" data={storesPerf} nameKey="storeName" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} onClick={(entry: any, index) => {
                      const d = storesPerf[index];
                      if (d?.storeId) router.push(`/stores/${d.storeId}/stats`);
                    }}>
                      {storesPerf.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v:any) => currencyFormat(Number(v ?? 0), kpis?.currency ?? 'EUR')} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-slate-500">Aucune donnée disponible</div>
              )}
            </div>

            <div className="flex-1">
              <ul className="space-y-2">
                {storesPerf && storesPerf.length > 0 ? storesPerf.map((s, i) => (
                  <li key={s.storeId} className="p-2 rounded border flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full" style={{ background: colors[i % colors.length] }} />
                      <div>
                        <div className="font-medium">{s.storeName}</div>
                        <div className="text-sm text-slate-500">{currencyFormat(Number(s.salesAmount ?? 0), kpis?.currency ?? 'EUR')}</div>
                      </div>
                    </div>
                    <button onClick={() => router.push(`/stores/${s.storeId}/stats`)} className="text-sm text-blue-600">Voir</button>
                  </li>
                )) : (
                  <li className="text-slate-500">Aucune donnée disponible</li>
                )}
              </ul>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
