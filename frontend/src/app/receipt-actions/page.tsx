'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingDots } from '@/components/ui/loading_dots';
import { Pencil, Search, Trash2 } from 'lucide-react';
import { getStoredUserRole } from '@/lib/auth';

interface Store {
  id: number;
  name: string;
}

interface Profile {
  ownedStores?: Store[];
  stores?: Store[];
  assignedStore?: Store;
}

type ReceiptActionType = 'UPDATE' | 'DELETE';

interface ReceiptAction {
  id: number;
  type: ReceiptActionType;
  reason: string;
  invoiceNumber: string;
  totalBefore: number;
  totalAfter?: number | null;
  createdAt: string;
  user: { id: number; name: string };
  store: { id: number; name: string; currency?: string | null };
  sale?: { id: number } | null;
  ticket?: {
    id: number;
    justification: string;
    createdAt: string;
    createdBy: { id: number; name: string };
  } | null;
}

const ALL_STORES = 'all';

const TYPE_LABEL: Record<ReceiptActionType, { label: string; className: string; icon: typeof Pencil }> = {
  UPDATE: { label: 'Modification', className: 'border-amber-200 bg-amber-50 text-amber-700', icon: Pencil },
  DELETE: { label: 'Suppression', className: 'border-red-200 bg-red-50 text-red-700', icon: Trash2 },
};

function getUniqueStores(profile: Profile | null): Store[] {
  if (!profile) return [];
  const all: Store[] = [
    ...(profile.ownedStores ?? []),
    ...(profile.stores ?? []),
    ...(profile.assignedStore ? [profile.assignedStore] : []),
  ];
  const map = new Map<string, Store>();
  all.forEach((store) => {
    if (store?.id !== undefined && store?.id !== null) map.set(String(store.id), store);
  });
  return Array.from(map.values());
}

const formatAmount = (value: number, currency?: string | null) => `${Number(value).toFixed(2)} ${currency || 'XOF'}`;

// Historique des modifications / suppressions de reçus (ADMIN) : motif,
// auteur, date, magasin, et signalement éventuellement validé par l'action.
export default function ReceiptActionsPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState(ALL_STORES);
  const [typeFilter, setTypeFilter] = useState<'' | ReceiptActionType>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [actions, setActions] = useState<ReceiptAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      router.push('/login');
      return;
    }
    if (getStoredUserRole() !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
    fetch(`${API}/auth/profil`, { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((profile: Profile | null) => setStores(getUniqueStores(profile)))
      .catch(() => setStores([]));
  }, [API, router, authHeaders]);

  const fetchActions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = selectedStoreId === ALL_STORES ? '' : `?storeId=${selectedStoreId}`;
      const res = await fetch(`${API}/sales/actions${query}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Impossible de charger l'historique des actions.");
      const data = await res.json();
      setActions(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }, [API, authHeaders, selectedStoreId]);

  useEffect(() => {
    if (getStoredUserRole() === 'ADMIN') fetchActions();
  }, [fetchActions]);

  const filteredActions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return actions.filter((a) => {
      if (typeFilter && a.type !== typeFilter) return false;
      if (!query) return true;
      return [a.invoiceNumber, a.user?.name, a.store?.name, a.reason, a.ticket?.justification, a.ticket?.createdBy?.name]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(query));
    });
  }, [actions, typeFilter, searchQuery]);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Historique des actions</h1>
            <p className="mt-1 text-muted-foreground">
              Modifications et suppressions de reçus, avec leur justificatif.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {stores.length > 1 && (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="rounded-lg border bg-white p-2 text-sm"
              >
                <option value={ALL_STORES}>Tous les magasins</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as '' | ReceiptActionType)}
              className="rounded-lg border bg-white p-2 text-sm"
            >
              <option value="">Toutes les actions</option>
              <option value="UPDATE">Modifications</option>
              <option value="DELETE">Suppressions</option>
            </select>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>
                {filteredActions.length} action{filteredActions.length > 1 ? 's' : ''}
              </CardTitle>
              <CardDescription>Les plus récentes en premier.</CardDescription>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="N° de reçu, auteur, motif…"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <LoadingDots size="h-3 w-3" color="bg-blue-600" />
              </div>
            ) : error ? (
              <div className="py-12 text-center font-semibold text-red-500">{error}</div>
            ) : filteredActions.length === 0 ? (
              <div className="py-12 text-center text-slate-400">Aucune action enregistrée.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Heure</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Reçu N°</TableHead>
                    <TableHead>Magasin</TableHead>
                    <TableHead>Effectuée par</TableHead>
                    <TableHead>Justificatif</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredActions.map((a) => {
                    const typeInfo = TYPE_LABEL[a.type];
                    const Icon = typeInfo.icon;
                    const currency = a.store?.currency;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-slate-600">
                          {new Date(a.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${typeInfo.className}`}
                          >
                            <Icon className="h-3 w-3" /> {typeInfo.label}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-slate-800">
                          {a.sale ? (
                            <button
                              type="button"
                              className="text-blue-600 hover:underline"
                              onClick={() => router.push(`/receipts?storeId=${a.store.id}&saleId=${a.sale!.id}`)}
                            >
                              {a.invoiceNumber}
                            </button>
                          ) : (
                            a.invoiceNumber
                          )}
                        </TableCell>
                        <TableCell className="text-slate-700">{a.store?.name ?? '—'}</TableCell>
                        <TableCell className="text-slate-700">{a.user?.name ?? '—'}</TableCell>
                        <TableCell className="max-w-sm">
                          <div className="text-sm">{a.reason}</div>
                          {a.ticket && (
                            <div className="mt-1 text-xs text-gray-500">
                              Ticket de {a.ticket.createdBy?.name ?? '—'} (
                              {new Date(a.ticket.createdAt).toLocaleDateString('fr-FR')}) : {a.ticket.justification}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono text-sm">
                          {a.type === 'UPDATE' && a.totalAfter !== null && a.totalAfter !== undefined ? (
                            <>
                              <span className="text-slate-400 line-through">{formatAmount(a.totalBefore, currency)}</span>
                              <div className="font-bold text-slate-900">{formatAmount(a.totalAfter, currency)}</div>
                            </>
                          ) : (
                            <span className="font-bold text-slate-900">{formatAmount(a.totalBefore, currency)}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
