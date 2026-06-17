'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, TrendingUp, Calendar, Layers } from 'lucide-react';

export default function StatsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [stats, setStats] = useState<any>(null);
  const [rawSales, setRawSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');
  
  // ÉTATS CORRIGÉS : On mémorise à la fois le libellé textuel pour le titre et l'identifiant pour le filtrage
  const [selectedPeriodText, setSelectedPeriodText] = useState<string>('');
  const [selectedPeriodId, setSelectedPeriodId] = useState<number>(0);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetch('http://localhost:3001/auth/profil', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setProfile(data);
        if (data.stores?.length > 0) {
          setSelectedStoreId(data.stores[0].id.toString());
        }
        setLoading(false);
      })
      .catch(() => router.push('/login'));
  }, [router]);

  useEffect(() => {
    if (!selectedStoreId) return;
    const token = localStorage.getItem('access_token');

    fetch(`http://localhost:3001/stores/${selectedStoreId}/stats`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setStats(data);
        const defaultData = timeframe === 'week' ? data.weekly : timeframe === 'year' ? data.yearly : data.monthly;
        if (defaultData && defaultData.length > 0) {
          // On se positionne par défaut sur la dernière barre disponible
          const activeItem = defaultData[defaultData.length - 1];
          setSelectedPeriodText(activeItem.date);
          setSelectedPeriodId(activeItem.id);
        }
      })
      .catch((err) => console.error(err));

    fetch(`http://localhost:3001/products/store/${selectedStoreId}/sales`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setRawSales(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  }, [selectedStoreId, timeframe]);

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50">Analyse des indicateurs...</div>;

  const activeChartData = 
    timeframe === 'week' ? stats?.weekly : 
    timeframe === 'year' ? stats?.yearly : stats?.monthly;

  const maxPeriodValue = activeChartData?.reduce((max: number, item: any) => item.valeur > max ? item.valeur : max, 0) || 1;

  // 📌 RECHERCHE ET FILTRAGE UNIVERSEL PAR INDEX NUMÉRIQUE (ZÉRO ERREUR DE LANGUE)
  const getProductDetailsForSelectedPeriod = () => {
    if (rawSales.length === 0) return [];

    const filteredSales = rawSales.filter((sale) => {
      const date = new Date(sale.createdAt);
      
      if (timeframe === 'week') {
        let dayIndex = date.getDay() - 1;
        if (dayIndex === -1) dayIndex = 6; // Lundi=0... Dimanche=6
        return dayIndex === selectedPeriodId;
      }
      
      if (timeframe === 'year') {
        return date.getFullYear() === selectedPeriodId;
      }
      
      return date.getMonth() === selectedPeriodId; // Mode mois (0 à 11)
    });

    const productMap = new Map<string, { sku: string; qty: number; total: number }>();
    
    filteredSales.forEach((sale) => {
      const existing = productMap.get(sale.productName);
      if (existing) {
        existing.qty += sale.quantity;
        existing.total += sale.total;
      } else {
        productMap.set(sale.productName, {
          sku: sale.sku || 'N/A',
          qty: sale.quantity,
          total: sale.total
        });
      }
    });

    return Array.from(productMap.entries()).map(([name, info]) => ({
      name,
      ...info
    }));
  };

  const detailedProducts = getProductDetailsForSelectedPeriod();

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between border-b border-slate-200 pb-5 mb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 flex items-center space-x-2">
              <BarChart3 className="text-blue-600" size={28} />
              <span>Performances Commerciales</span>
            </h1>
            <p className="text-slate-500 text-sm mt-1">Cliquez sur une barre verticale pour lister l'inventaire écoulé.</p>
          </div>
          
          <div className="flex items-center space-x-3 bg-white p-1.5 border border-slate-200 rounded-xl shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase px-2 tracking-wider">Entrepôt :</span>
            <select 
              value={selectedStoreId} 
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="p-1.5 px-3 rounded-lg text-sm bg-slate-50 border border-slate-200 font-semibold outline-none text-slate-700 focus:border-blue-500 cursor-pointer"
            >
              {profile?.stores?.map((store: any) => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card className="border-none shadow-sm bg-gradient-to-br from-blue-600 to-indigo-700 text-white overflow-hidden relative">
            <CardContent className="p-6 space-y-2">
              <span className="text-xs font-bold text-indigo-100 uppercase tracking-widest">Chiffre d'Affaires Réel</span>
              <div className="text-3xl font-black font-mono tracking-tight">{stats?.summary?.totalRevenue?.toFixed(2) || '0.00'} <span className="text-sm font-sans uppercase">{stats?.currency || 'XOF'}</span></div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200 shadow-sm bg-white"><CardContent className="p-6 space-y-2"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Valeur du Stock Restant</span><div className="text-3xl font-black font-mono tracking-tight text-green-600">
  {stats?.summary?.totalRevenue?.toFixed(2)} <span className="text-sm font-sans uppercase">{stats?.currency || 'XOF'}</span></div></CardContent></Card>
          <Card className="border border-slate-200 shadow-sm bg-white"><CardContent className="p-6 space-y-2"><span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Volume en Rayon</span><div className="text-3xl font-black font-mono tracking-tight text-slate-800">
  {stats?.summary?.totalValue?.toFixed(2)} <span className="text-sm font-sans uppercase">{stats?.currency || 'XOF'}</span>
</div></CardContent></Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2 border border-slate-200 shadow-sm bg-white flex flex-col justify-between">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6 border-b border-slate-50">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Histogramme des Ventes</CardTitle>
                <CardDescription>Période active : <span className="font-bold text-blue-600 underline">{selectedPeriodText}</span></CardDescription>
              </div>
              <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-1 space-x-1 shadow-inner">
                <Button size="sm" variant={timeframe === 'week' ? 'default' : 'ghost'} className="rounded-lg font-semibold text-xs" onClick={() => setTimeframe('week')}>Semaine</Button>
                <Button size="sm" variant={timeframe === 'month' ? 'default' : 'ghost'} className="rounded-lg font-semibold text-xs" onClick={() => setTimeframe('month')}>Mois</Button>
                <Button size="sm" variant={timeframe === 'year' ? 'default' : 'ghost'} className="rounded-lg font-semibold text-xs" onClick={() => setTimeframe('year')}>Année</Button>
              </div>
            </CardHeader>
            
            <CardContent className="h-72 flex items-end justify-between px-6 pt-10 relative bg-gradient-to-t from-slate-50/50 to-transparent">
              <div className="absolute inset-x-6 bottom-14 top-10 flex flex-col justify-between pointer-events-none border-b border-slate-100">
                <div className="w-full border-t border-dashed border-slate-100" />
                <div className="w-full border-t border-dashed border-slate-100" />
              </div>

              {activeChartData?.map((item: any, idx: number) => {
                const isSelected = item.id === selectedPeriodId; // Comparaison par ID numérique invariable
                const barHeight = maxPeriodValue > 0 ? (item.valeur / maxPeriodValue) * 75 : 0;

                return (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setSelectedPeriodText(item.date);
                      setSelectedPeriodId(item.id); // FIXATION DE L'INDEX NUMÉRIQUE AU CLIC
                    }} 
                    className="flex flex-col items-center flex-1 group h-full justify-end cursor-pointer relative z-10">
                                        <span className={`text-[10px] font-mono font-bold mb-2 p-1 px-1.5 rounded transition-all duration-200 shadow-sm ${isSelected ? 'opacity-100 bg-slate-                                              950 text-blue-400 scale-105' : 'opacity-0 group-hover:opacity-100 bg-white border text-slate-600'}`}>
                                              {item.valeur.toFixed(0)} {stats?.currency || 'XOF'}
                                        </span>
                    <div 
                      className={`w-10 rounded-t-xl transition-all duration-300 ${
                        isSelected 
                          ? 'bg-gradient-to-t from-blue-600 via-indigo-500 to-cyan-400 shadow-md scale-x-105' 
                          : item.valeur > 0 ? 'bg-gradient-to-t from-slate-200 to-slate-300 group-hover:from-blue-400' : 'bg-slate-200/60'
                      }`} 
                      style={{ height: `${item.valeur > 0 ? Math.max(barHeight, 8) : 4}%` }} 
                    />
                    <span className={`text-xs mt-3 font-semibold transition-colors ${
                      isSelected ? 'text-blue-600 font-bold' : 'text-slate-400'
                    }`}>
                      {item.date}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* TABLEAU PANNEAU LATÉRAL DU DRILL-DOWN HISTORISÉ */}
          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardHeader className="border-b border-slate-50 pb-4">
              <CardTitle className="text-base font-bold text-slate-900">Détails de la Période</CardTitle>
              <CardDescription>Articles expédiés en <span className="font-semibold text-gray-900">{selectedPeriodText}</span></CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="pl-4 text-xs font-bold text-slate-400 uppercase">Produit</TableHead>
                    <TableHead className="text-center text-xs font-bold text-slate-400 uppercase">Qté</TableHead>
                    <TableHead className="text-right pr-4 text-xs font-bold text-slate-400 uppercase">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailedProducts.map((prod, index) => (
                    <TableRow key={index} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="font-medium text-xs pl-4">
                        <div className="text-slate-800 font-semibold">{prod.name}</div>
                        <span className="text-[10px] text-slate-400 font-mono">SKU: {prod.sku}</span>
                      </TableCell>
                      <TableCell className="text-center font-bold text-slate-700 text-xs">x{prod.qty}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-emerald-600 text-xs pr-4">+{prod.total.toFixed(2)} {stats?.currency || 'XOF'}</TableCell>
                    </TableRow>
                  ))}

                  {detailedProducts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-xs text-slate-400">
                        Aucune vente enregistrée sur cette période.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

