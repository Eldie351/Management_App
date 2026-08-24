'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, CalendarDays, X, CircleX } from 'lucide-react';
import { getStoredUserRole } from '@/lib/auth';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type Period = 'week' | 'month' | 'year';

interface StoreOption { id: number; name: string }
interface CashierOption { id: number; name: string }

interface CashierProductRow {
  cashierId: number | string;
  cashierName: string;
  productId: number | string;
  productName: string;
  quantitySold: number;
  totalAmount: number;
  stockQty?: number | null;
  stockValue?: number | null;
  currency?: string | null;
}

// -----------------------------------------------------------------------------
// Date helpers (copied/adapted from existing stats page)
// -----------------------------------------------------------------------------
const MONTHS_FR = [
  'Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre',
];
const DAYS_FR_SHORT = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
function pad(n: number) { return n.toString().padStart(2,'0'); }
function toDateKey(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function sameDay(a: Date,b: Date) { return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
function startOfWeek(d: Date){ const date=new Date(d); const day=(date.getDay()+6)%7; date.setDate(date.getDate()-day); date.setHours(0,0,0,0); return date; }
function endOfWeek(d: Date){ const s=startOfWeek(d); const e=new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return e; }
function startOfMonth(d: Date){ return new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0); }
function endOfMonth(d: Date){ return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999); }
function startOfYear(d: Date){ return new Date(d.getFullYear(),0,1,0,0,0,0); }
function endOfYear(d: Date){ return new Date(d.getFullYear(),11,31,23,59,59,999); }
function shiftPeriod(d: Date, period: Period, delta: number){ const next=new Date(d); if(period==='week') next.setDate(next.getDate()+delta*7); if(period==='month') next.setMonth(next.getMonth()+delta); if(period==='year') next.setFullYear(next.getFullYear()+delta); return next; }
function rangeLabel(period: Period, start: Date, end: Date){ if(period==='week'){ return `${pad(start.getDate())}/${pad(start.getMonth()+1)} → ${pad(end.getDate())}/${pad(end.getMonth()+1)}/${end.getFullYear()}`; } if(period==='month'){ return `${MONTHS_FR[start.getMonth()]} ${start.getFullYear()}`; } return `Année ${start.getFullYear()}`; }

function currencyFormatter(currency: string){ return (amount: number) => {
  try { return new Intl.NumberFormat('fr-FR',{ style: 'currency', currency, maximumFractionDigits: 0 }).format(amount || 0); }
  catch { return `${(amount||0).toLocaleString('fr-FR')} ${currency}`; }
}; }

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------
export default function CashiersStatsPage(){
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [period, setPeriod] = useState<Period>('week');
  const [anchor, setAnchor] = useState<Date>(()=>new Date());
  const { start, end, label } = useMemo(()=>{ let s:Date,e:Date; if(period==='week'){ s=startOfWeek(anchor); e=endOfWeek(anchor);} else if(period==='month'){ s=startOfMonth(anchor); e=endOfMonth(anchor);} else { s=startOfYear(anchor); e=endOfYear(anchor);} return { start:s, end:e, label: rangeLabel(period, s, e)}; },[period,anchor]);

  const [storeFilter, setStoreFilter] = useState<string>('');
  const [cashierFilter, setCashierFilter] = useState<string>('');

  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [cashierOptions, setCashierOptions] = useState<CashierOption[]>([]);

  const [calendarOpen, setCalendarOpen] = useState(false);

  const [rows, setRows] = useState<CashierProductRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(()=>setMounted(true),[]);

  useEffect(()=>{
    const token = localStorage.getItem('access_token');
    if(!token){ router.push('/login'); return; }
    const role = getStoredUserRole();
    // Allow ADMIN, MANAGER and CASHIER? The original /stats blocked CASHIER — for cashiers stats we allow MANAGER/ADMIN only
    if(role === 'CASHIER'){ router.push('/dashboard'); return; }
    setCheckingAccess(false);
  },[router]);

  const authedFetch = useCallback(async (path: string)=>{
    const token = localStorage.getItem('access_token');
    const res = await fetch(`${API}${path}`,{ headers: { Authorization: `Bearer ${token}` } });
    if(res.status === 401){ localStorage.removeItem('access_token'); router.push('/login'); return null; }
    if(!res.ok){ let message = `Erreur ${res.status}`; try{ const data = await res.json(); if(data?.message) message = Array.isArray(data.message)? data.message.join(', '): data.message; }catch{} throw new Error(message); }
    return res.json();
  },[API,router]);

  // load stores
  useEffect(()=>{
    if(checkingAccess) return;
    (async ()=>{
      try{
        const data = await authedFetch('/stores');
        if(!data) return;
        const list = Array.isArray(data)? data : (data.data ?? []);
        setStoreOptions(list.map((s:any)=>({ id: s.id, name: s.name })));
      }catch(err){ console.error('load stores', err); }
    })();
  },[checkingAccess, authedFetch]);

  // load cashiers (simple endpoint; fallback to staff list)
  useEffect(()=>{
    if(checkingAccess) return;
    (async ()=>{
      try{
        const data = await authedFetch('/staff');
        if(!data) return;
        const list = Array.isArray(data)? data : (data.data ?? []);
        // filter roles for cashiers if available
        setCashierOptions(list.filter((u:any)=> !u.deleted).map((u:any)=>({ id: u.id, name: u.name ?? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.username || 'Utilisateur' })));
      }catch(err){ console.error('load cashiers', err); }
    })();
  },[checkingAccess, authedFetch]);

  // load report rows
  useEffect(()=>{
    if(checkingAccess) return;
    let canceled = false;
    (async ()=>{
      setLoading(true); setError(null);
      try{
        const storeParam = storeFilter ? `&storeId=${storeFilter}` : '';
        const cashierParam = cashierFilter ? `&cashierId=${cashierFilter}` : '';
        // Proposed endpoint
        const path = `/reports/cashiers/daily-products?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}${storeParam}${cashierParam}`;
        const data = await authedFetch(path);
        if(canceled || !data) return;
        const rowsRaw = Array.isArray(data)? data : (data.data ?? []);
        // Normalize rows — accept multiple possible keys
        const normalized: CashierProductRow[] = rowsRaw.map((r:any)=>({
          cashierId: r.cashierId ?? r.cashier_id ?? r.userId ?? r.user_id ?? r.cashier?.id ?? 'unknown',
          cashierName: r.cashierName ?? r.cashier_name ?? r.cashier?.name ?? r.userName ?? r.user_name ?? r.cashier?.fullName ?? r.cashier?.username ?? 'Caissier',
          productId: r.productId ?? r.product_id ?? r.id ?? r.product?.id ?? 'prod',
          productName: r.productName ?? r.product_name ?? r.product?.name ?? r.name ?? 'Produit',
          quantitySold: Number(r.quantitySold ?? r.quantity_sold ?? r.quantity ?? r.soldQuantity ?? 0),
          totalAmount: Number(r.totalAmount ?? r.total_amount ?? r.amount ?? r.total ?? 0),
          stockQty: r.stockQty ?? r.stock_qty ?? r.stock ?? null,
          stockValue: r.stockValue ?? r.stock_value ?? null,
          currency: r.currency ?? r.curr ?? null,
        }));
        setRows(normalized);
      }catch(err:any){ console.error('load report', err); if(!canceled) setError(err?.message || 'Impossible de charger le rapport.'); setRows(null); }
      finally{ if(!canceled) setLoading(false); }
    })();
    return ()=>{ canceled = true; };
  },[checkingAccess, start, end, storeFilter, cashierFilter, authedFetch]);

  function goPrev(){ setAnchor((d)=> shiftPeriod(d, period, -1)); }
  function goNext(){ setAnchor((d)=> shiftPeriod(d, period, 1)); }
  function goToday(){ setAnchor(new Date()); setPeriod('week'); }

  // Group rows by cashier for display
  const grouped = useMemo(()=>{
    const map = new Map<string, { cashierName: string; items: CashierProductRow[] }>();
    (rows ?? []).forEach(r=>{
      const key = String(r.cashierId);
      const existing = map.get(key);
      if(!existing) map.set(key, { cashierName: r.cashierName, items: [r] }); else existing.items.push(r);
    });
    return Array.from(map.entries()).map(([id, v])=>({ cashierId: id, cashierName: v.cashierName, items: v.items }));
  },[rows]);

  // Export CSV
  const exportCsv = useCallback(()=>{
    if(!rows || rows.length===0) return;
    const header = ['Caissier','Produit','Qté vendue','Somme vendue','Qté restante','Valeur stock restant','Devise'];
    const lines = [header.join(';')];
    rows.forEach(r=>{
      lines.push([r.cashierName, r.productName, String(r.quantitySold), String(r.totalAmount), r.stockQty == null ? '' : String(r.stockQty), r.stockValue == null ? '' : String(r.stockValue), r.currency ?? ''].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';'));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cashiers-report-${pad(start.getDate())}${pad(start.getMonth()+1)}-${start.getFullYear()}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  },[rows, start]);

  const formatCurrency = useMemo(()=> currencyFormatter(rows?.[0]?.currency ?? 'XOF'), [rows]);

  if(checkingAccess){
    return (<div className="flex h-screen items-center justify-center text-sm text-muted-foreground">Vérification de l'accès…</div>);
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="border-b pb-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Statistiques Caissiers</h1>
            <p className="mt-1 text-sm text-gray-500">Rapport quotidien par produit pour chaque caissier</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {storeFilter && (
              <button onClick={()=>setStoreFilter('')} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" title="Réinitialiser le filtre magasin"><CircleX className="size-3.5"/> Réinitialiser</button>
            )}
            <select value={storeFilter} onChange={(e)=>setStoreFilter(e.target.value)} className="px-3 py-2 text-sm border rounded-md bg-white shadow-sm min-w-[160px]">
              <option value="">Tous les magasins</option>
              {storeOptions.map(s=>(<option key={s.id} value={s.id}>{s.name}</option>))}
            </select>

            <select value={cashierFilter} onChange={(e)=>setCashierFilter(e.target.value)} className="px-3 py-2 text-sm border rounded-md bg-white shadow-sm min-w-[160px]">
              <option value="">Tous les caissiers</option>
              {cashierOptions.map(c=>(<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>

            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader className="flex flex-col gap-4 pb-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-lg">Rapport quotidien par produit</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Période: {label}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex bg-muted rounded-md overflow-hidden p-0.5">
                {(['week','month','year'] as Period[]).map(p=> (
                  <button key={p} onClick={()=>{ setPeriod(p); setCalendarOpen(false); }} className={`px-3 py-1.5 text-sm rounded-sm transition-colors ${period===p ? 'bg-white shadow-sm font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{p==='week' ? 'Semaine' : p==='month' ? 'Mois' : 'Année'}</button>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={goToday}>Aujourd'hui</Button>

              <Button variant="outline" size="sm" onClick={()=>setCalendarOpen(o=>!o)} aria-expanded={calendarOpen}><CalendarDays className="size-4"/> Calendrier</Button>
            </div>
          </CardHeader>

          <CardContent>
            {calendarOpen && (
              <div className="mb-5 rounded-xl border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <Button variant="ghost" size="icon" onClick={goPrev} title="Précédent">‹</Button>
                  <p className="text-sm font-medium capitalize">{period==='year' ? anchor.getFullYear() : `${MONTHS_FR[anchor.getMonth()]} ${anchor.getFullYear()}`}</p>
                  <Button variant="ghost" size="icon" onClick={goNext} title="Suivant">›</Button>
                </div>
                {/* Simple month grid for selection */}
                {period==='month' && (
                  <div className="grid grid-cols-7 text-center text-[11px] uppercase text-muted-foreground mb-1">
                    {DAYS_FR_SHORT.map(d=>(<div key={d} className="py-1">{d}</div>))}
                  </div>
                )}
                {/* For brevity we keep calendar minimal (reuse existing /stats calendar if needed) */}
              </div>
            )}

            <div>
              {loading || !mounted ? (
                <Skeleton className="h-48 w-full" />
              ) : error ? (
                <div className="p-6 text-sm text-destructive">{error}</div>
              ) : !rows || rows.length===0 ? (
                <div className="p-6 text-sm text-muted-foreground">Aucune donnée disponible pour la période sélectionnée.</div>
              ) : (
                <div className="space-y-6">
                  {grouped.map(group=> (
                    <div key={group.cashierId} className="border rounded-lg bg-white overflow-hidden">
                      <div className="px-4 py-3 border-b flex items-center justify-between">
                        <div>
                          <p className="font-medium">{group.cashierName}</p>
                          <p className="text-xs text-muted-foreground">Total produits: {group.items.length}</p>
                        </div>
                        <div className="text-sm text-muted-foreground">Période: {label}</div>
                      </div>

                      <div className="p-3">
                        <table className="w-full text-sm table-fixed">
                          <thead>
                            <tr className="text-left text-xs text-muted-foreground border-b">
                              <th className="pb-2 w-1/3">Produit</th>
                              <th className="pb-2 w-1/6">Qté vendue</th>
                              <th className="pb-2 w-1/6">Somme vendue</th>
                              <th className="pb-2 w-1/6">Qté restante</th>
                              <th className="pb-2 w-1/6">Valeur stock</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {group.items.map(item=> (
                              <tr key={`${group.cashierId}-${item.productId}`} className="odd:bg-muted/50">
                                <td className="py-2 pr-3">{item.productName}</td>
                                <td className="py-2 pr-3">{item.quantitySold}</td>
                                <td className="py-2 pr-3">{formatCurrency(item.totalAmount)}</td>
                                <td className="py-2 pr-3">{item.stockQty ?? '—'}</td>
                                <td className="py-2 pr-3">{item.stockValue != null ? formatCurrency(item.stockValue) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
