'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { LoadingDots } from '@/components/ui/loading_dots';
import { getStoredUserRole, hasAccess, type AppRole } from '@/lib/auth';

interface Store {
  id: number;
  name: string;
  currency?: string | null;
}

interface Product {
  id: number;
  name: string;
  sku?: string | null;
  quantity: number;
}

interface StaffMember {
  id: number;
  name: string;
  email: string;
  role: AppRole;
}

type TicketStatus = 'OPEN' | 'APPROVED' | 'CLOSED';

interface Ticket {
  id: number;
  status: TicketStatus;
  justification: string;
  requestedQuantity?: number | null;
  resolutionNote?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  store?: { id: number; name: string };
  product: { id: number; name: string; sku?: string | null; quantity: number };
  createdBy: { id: number; name: string; role: AppRole };
  recipient: { id: number; name: string; role: AppRole };
  resolvedBy?: { id: number; name: string } | null;
}

const ALL_STORES = 'all';

interface Profile {
  id: number;
  assignedStoreId?: number | null;
  assignedStore?: Store;
  ownedStores?: Store[];
  stores?: Store[];
}

interface ColleagueGroup {
  store: { id: number; name: string };
  staff: StaffMember[];
}

const STATUS_LABEL: Record<TicketStatus, { label: string; className: string }> = {
  OPEN: { label: 'En attente', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  APPROVED: { label: 'Approuvé', className: 'border-green-200 bg-green-50 text-green-700' },
  CLOSED: { label: 'Fermé', className: 'border-gray-200 bg-gray-50 text-gray-600' },
};

function getUniqueStores(profile: Profile | null): Store[] {
  if (!profile) return [];
  const all: Store[] = [];
  if (Array.isArray(profile.ownedStores)) all.push(...profile.ownedStores);
  if (Array.isArray(profile.stores)) all.push(...profile.stores);
  if (profile.assignedStore) all.push(profile.assignedStore);

  const map = new Map<string, Store>();
  all.forEach((store) => {
    if (store && store.id !== undefined && store.id !== null) {
      map.set(String(store.id), store);
    }
  });
  return Array.from(map.values());
}

function TicketsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [role, setRole] = useState<AppRole | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [colleagues, setColleagues] = useState<ColleagueGroup[]>([]);

  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState('');
  const [justification, setJustification] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState<string>('');
  const [createError, setCreateError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [resolvingTicket, setResolvingTicket] = useState<Ticket | null>(null);
  const [resolvingAction, setResolvingAction] = useState<'approve' | 'close' | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const canCreate = hasAccess(role, ['CASHIER', 'MANAGER']);
  const canEverResolve = hasAccess(role, ['ADMIN', 'MANAGER']);

  const authHeaders = useCallback(() => {
    const token = localStorage.getItem('access_token');
    return { Authorization: `Bearer ${token}` };
  }, []);

  // 1. Profil + rôle + magasins accessibles + collègues (pour choisir un destinataire)
  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      setRole(getStoredUserRole());

      try {
        const [profileRes, colleaguesRes] = await Promise.all([
          fetch(`${API}/auth/profil`, { headers: authHeaders() }),
          fetch(`${API}/users/colleagues`, { headers: authHeaders() }),
        ]);
        if (!profileRes.ok) throw new Error('Session expirée.');
        const profile: Profile = await profileRes.json();
        setCurrentUserId(profile.id);
        const uniqueStores = getUniqueStores(profile);
        setStores(uniqueStores);

        if (colleaguesRes.ok) {
          const colleaguesData = await colleaguesRes.json();
          setColleagues(Array.isArray(colleaguesData) ? colleaguesData : []);
        }

        const storeIdParam = searchParams.get('storeId');
        const initialStoreId =
          storeIdParam ?? (uniqueStores.length > 0 ? String(uniqueStores[0].id) : '');
        setSelectedStoreId(initialStoreId);
      } catch (err: any) {
        setError(err.message || 'Impossible de charger votre profil.');
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, API]);

  const fetchTickets = useCallback(
    async (storeId: string) => {
      if (!storeId) {
        setTickets([]);
        return;
      }
      setTicketsLoading(true);
      setTicketsError('');
      try {
        const url =
          storeId === ALL_STORES ? `${API}/tickets/all` : `${API}/tickets/store/${storeId}`;
        const res = await fetch(url, { headers: authHeaders() });
        if (!res.ok) throw new Error('Impossible de charger les tickets.');
        const data = await res.json();
        setTickets(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setTicketsError(err.message || 'Erreur lors du chargement des tickets.');
      } finally {
        setTicketsLoading(false);
      }
    },
    [API, authHeaders],
  );

  const fetchStoreProducts = useCallback(
    async (storeId: string) => {
      if (!storeId) {
        setStoreProducts([]);
        return;
      }
      try {
        const res = await fetch(`${API}/products/store/${storeId}`, { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        setStoreProducts(Array.isArray(data) ? data : []);
      } catch {
        // Non bloquant : la liste de produits n'est utile que pour le formulaire de création.
      }
    },
    [API, authHeaders],
  );

  useEffect(() => {
    if (!selectedStoreId) return;
    fetchTickets(selectedStoreId);
    if (canCreate && selectedStoreId !== ALL_STORES) fetchStoreProducts(selectedStoreId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStoreId, canCreate, fetchTickets, fetchStoreProducts]);

  // Ouverture directe du formulaire depuis la page Alertes (?productId=&storeId=)
  useEffect(() => {
    const productIdParam = searchParams.get('productId');
    if (productIdParam && canCreate && selectedStoreId) {
      setSelectedProductId(productIdParam);
      setIsCreateModalOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCreate, selectedStoreId]);

  const currentStore = stores.find((s) => String(s.id) === selectedStoreId);

  // Destinataires possibles pour le magasin sélectionné : les ADMIN/MANAGER
  // de ce magasin, hors moi-même.
  const eligibleRecipients: StaffMember[] = (
    colleagues.find((c) => String(c.store.id) === selectedStoreId)?.staff ?? []
  ).filter((s) => (s.role === 'ADMIN' || s.role === 'MANAGER') && s.id !== currentUserId);

  const resetCreateForm = () => {
    setSelectedProductId('');
    setSelectedRecipientId('');
    setJustification('');
    setRequestedQuantity('');
    setCreateError('');
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!selectedProductId) {
      setCreateError('Veuillez sélectionner un produit.');
      return;
    }
    if (!selectedRecipientId) {
      setCreateError('Veuillez choisir un destinataire.');
      return;
    }
    if (!justification.trim()) {
      setCreateError('Veuillez indiquer une justification.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          storeId: Number(selectedStoreId),
          productId: Number(selectedProductId),
          recipientId: Number(selectedRecipientId),
          justification: justification.trim(),
          requestedQuantity: requestedQuantity ? Number(requestedQuantity) : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Impossible de créer le ticket.");
      }

      resetCreateForm();
      setIsCreateModalOpen(false);
      await fetchTickets(selectedStoreId);
    } catch (err: any) {
      setCreateError(err.message || 'Une erreur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canResolveTicket = (ticket: Ticket) =>
    ticket.status === 'OPEN' && (role === 'ADMIN' || ticket.recipient?.id === currentUserId);

  const openResolveModal = (ticket: Ticket, action: 'approve' | 'close') => {
    setResolvingTicket(ticket);
    setResolvingAction(action);
    setResolutionNote('');
  };

  const handleResolveTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingTicket || !resolvingAction) return;

    setIsResolving(true);
    try {
      const res = await fetch(`${API}/tickets/${resolvingTicket.id}/${resolvingAction}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ resolutionNote: resolutionNote.trim() || undefined }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Impossible de mettre à jour ce ticket.');
      }

      setResolvingTicket(null);
      setResolvingAction(null);
      await fetchTickets(selectedStoreId);
    } catch (err: any) {
      setTicketsError(err.message || 'Une erreur est survenue.');
    } finally {
      setIsResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <LoadingDots size="h-4 w-4" color="bg-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center font-semibold text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tickets de réapprovisionnement</h1>
            <p className="mt-1 text-muted-foreground">
              {canCreate
                ? 'Choisissez un destinataire (manager ou admin) pour votre demande.'
                : 'Suivez et traitez les tickets qui vous sont adressés.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {stores.length > 0 && (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="rounded-lg border bg-white p-2 text-sm"
              >
                {stores.length > 1 && <option value={ALL_STORES}>Tous les magasins</option>}
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
            {canCreate && (
              <Button
                onClick={() => {
                  resetCreateForm();
                  setIsCreateModalOpen(true);
                }}
                disabled={!selectedStoreId || selectedStoreId === ALL_STORES}
                title={selectedStoreId === ALL_STORES ? 'Choisissez un magasin précis pour ouvrir un ticket.' : undefined}
              >
                + Nouveau ticket
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              ← Tableau de bord
            </Button>
          </div>
        </div>

        {!selectedStoreId ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Aucun magasin ne vous est assigné pour le moment.
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                Tickets —{' '}
                {selectedStoreId === ALL_STORES
                  ? 'Tous les magasins'
                  : currentStore?.name ?? `Magasin #${selectedStoreId}`}
              </CardTitle>
              <CardDescription>
                {canEverResolve
                  ? "Vous pouvez traiter les tickets qui vous sont adressés (un admin peut traiter n'importe quel ticket du magasin)."
                  : 'Tous les tickets ouverts sur ce magasin, y compris ceux de vos collègues.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ticketsError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                  {ticketsError}
                </div>
              )}
              {ticketsLoading ? (
                <div className="py-12 text-center text-slate-400">Chargement...</div>
              ) : tickets.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  {selectedStoreId === ALL_STORES
                    ? 'Aucun ticket sur vos magasins.'
                    : 'Aucun ticket pour ce magasin.'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {selectedStoreId === ALL_STORES && <TableHead>Magasin</TableHead>}
                      <TableHead>Produit</TableHead>
                      <TableHead>Justification</TableHead>
                      <TableHead className="text-center">Qté demandée</TableHead>
                      <TableHead>Ouvert par</TableHead>
                      <TableHead>Destinataire</TableHead>
                      <TableHead>Statut</TableHead>
                      {canEverResolve && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tickets.map((ticket) => {
                      const statusInfo = STATUS_LABEL[ticket.status];
                      return (
                        <TableRow key={ticket.id}>
                          {selectedStoreId === ALL_STORES && (
                            <TableCell className="text-sm text-gray-600">
                              {ticket.store?.name ?? '—'}
                            </TableCell>
                          )}
                          <TableCell className="font-medium">
                            {ticket.product.name}
                            <div className="text-xs text-gray-400">
                              Stock actuel : {ticket.product.quantity}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="text-sm">{ticket.justification}</div>
                            {ticket.resolutionNote && (
                              <div className="mt-1 text-xs text-gray-500">
                                Réponse : {ticket.resolutionNote}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {ticket.requestedQuantity ?? '—'}
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {ticket.createdBy?.name ?? '—'}
                            <div className="text-xs text-gray-400">
                              {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {ticket.recipient?.name ?? '—'}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.className}`}
                            >
                              {statusInfo.label}
                            </span>
                          </TableCell>
                          {canEverResolve && (
                            <TableCell className="text-right space-x-2">
                              {canResolveTicket(ticket) ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => openResolveModal(ticket, 'approve')}
                                  >
                                    Valider
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openResolveModal(ticket, 'close')}
                                  >
                                    Fermer
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* MODALE DE CRÉATION DE TICKET (CASHIER / MANAGER) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <Card className="w-[480px] shadow-2xl bg-white">
            <CardHeader>
              <CardTitle>Nouveau ticket de réapprovisionnement</CardTitle>
              <CardDescription>
                Choisissez un destinataire (manager ou admin de ce magasin) qui examinera la demande.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                {createError && (
                  <p className="rounded bg-red-50 p-2 text-center text-sm text-red-500">{createError}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="ticketProduct">Produit concerné *</Label>
                  <select
                    id="ticketProduct"
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full rounded-lg border bg-white p-2 text-sm"
                    required
                  >
                    <option value="">— Sélectionner un produit —</option>
                    {storeProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.quantity} en stock)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticketRecipient">Destinataire *</Label>
                  <select
                    id="ticketRecipient"
                    value={selectedRecipientId}
                    onChange={(e) => setSelectedRecipientId(e.target.value)}
                    className="w-full rounded-lg border bg-white p-2 text-sm"
                    required
                  >
                    <option value="">— Choisir un destinataire —</option>
                    {eligibleRecipients.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role === 'ADMIN' ? 'Admin' : 'Manager'})
                      </option>
                    ))}
                  </select>
                  {eligibleRecipients.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Aucun manager/admin trouvé pour ce magasin.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticketQuantity">Quantité souhaitée (optionnel)</Label>
                  <Input
                    id="ticketQuantity"
                    type="number"
                    min="1"
                    value={requestedQuantity}
                    onChange={(e) => setRequestedQuantity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ticketJustification">Justification *</Label>
                  <textarea
                    id="ticketJustification"
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    rows={4}
                    className="w-full rounded-lg border bg-white p-2 text-sm"
                    placeholder="Ex : rupture prévue d'ici la fin de semaine au vu des ventes récentes."
                    required
                  />
                </div>
                <div className="flex justify-end gap-3 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetCreateForm();
                      setIsCreateModalOpen(false);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Envoi…' : 'Envoyer la demande'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODALE DE RÉSOLUTION (destinataire du ticket, ou ADMIN du magasin) */}
      {resolvingTicket && resolvingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <Card className="w-[480px] shadow-2xl bg-white">
            <CardHeader>
              <CardTitle>
                {resolvingAction === 'approve' ? 'Approuver ce ticket ?' : 'Fermer ce ticket ?'}
              </CardTitle>
              <CardDescription>
                {resolvingTicket.product.name} — demandé par {resolvingTicket.createdBy?.name ?? '—'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResolveTicket} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resolutionNote">Note (optionnel)</Label>
                  <textarea
                    id="resolutionNote"
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border bg-white p-2 text-sm"
                    placeholder={
                      resolvingAction === 'close'
                        ? 'Ex : stock suffisant pour le moment.'
                        : 'Ex : réapprovisionnement programmé pour demain.'
                    }
                  />
                </div>
                <div className="flex justify-end gap-3 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setResolvingTicket(null);
                      setResolvingAction(null);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isResolving}>
                    {isResolving
                      ? 'Envoi…'
                      : resolvingAction === 'approve'
                        ? 'Valider'
                        : 'Fermer le ticket'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Chargement...</div>}>
      <TicketsContent />
    </Suspense>
  );
}
