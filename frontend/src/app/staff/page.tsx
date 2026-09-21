'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { LoadingDots } from '@/components/ui/loading_dots';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStoredUserRole } from '@/lib/auth';
import { useRouter } from 'next/navigation';

interface Store {
  id: number;
  name: string;
  location?: string | null;
}

interface StoreAssignment {
  store: {
    id: number;
    name: string;
    location?: string | null;
  };
}

interface StaffMember {
  id: number;
  name: string;
  email: string;
  role: 'MANAGER' | 'CASHIER';
  createdAt: string;
  storeAssignments: StoreAssignment[];
}

interface StoreGroup {
  storeName: string;
  staff: StaffMember[];
}

export default function StaffPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Édition des magasins affectés à un membre du staff
  const [editingStoresFor, setEditingStoresFor] = useState<StaffMember | null>(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
  const [savingStores, setSavingStores] = useState(false);
  const [storesError, setStoresError] = useState('');

  useEffect(() => {
    const role = getStoredUserRole();
    const token = localStorage.getItem('access_token');

    if (!token) {
      router.push('/login');
      return;
    }

    if (role !== 'ADMIN') {
      router.push('/');
      return;
    }

    const fetchStaff = async () => {
      try {
        const response = await fetch(`${API}/users/staff`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.message || 'Impossible de charger les comptes du personnel.');
        }

        const data = await response.json();
        setStaff(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message || 'Erreur de chargement.');
      } finally {
        setLoading(false);
      }
    };

    const fetchStores = async () => {
      try {
        const response = await fetch(`${API}/stores`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) return;
        const data = await response.json();
        setStores(Array.isArray(data) ? data : []);
      } catch {
        // La liste des magasins n'est utilisée que pour le formulaire
        // d'affectation ; une erreur ici ne doit pas bloquer la page.
      }
    };

    fetchStaff();
    fetchStores();
  }, [router, API]);

  // 1. ÉCRAN DE CHARGEMENT PLEIN ÉCRAN
  // Tant que l'API n'a pas répondu, la page n'affiche RIEN d'autre que les points bleus centrés
  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100">
        <LoadingDots size="h-4 w-4" color="bg-blue-600" />
      </div>
    );
  }

  const staffByStore = staff.reduce<Record<string, StaffMember[]>>((groups, member) => {
    const assignments = member.storeAssignments ?? [];
    if (assignments.length === 0) {
      const key = 'Non assigné';
      if (!groups[key]) groups[key] = [];
      groups[key].push(member);
      return groups;
    }
    // Un employé affecté à plusieurs magasins doit apparaître dans la liste
    // de CHACUN de ces magasins, pas uniquement dans le premier.
    for (const assignment of assignments) {
      const key = assignment.store?.name || 'Non assigné';
      if (!groups[key]) groups[key] = [];
      groups[key].push(member);
    }
    return groups;
  }, {});

  const storeGroups: StoreGroup[] = Object.entries(staffByStore).map(([storeName, members]) => ({
    storeName,
    staff: members,
  }));

  const deleteStaff = async (id: number) => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    setDeleteError(null);
    setDeleteSuccess(null);
    setDeletingId(id);

    try {
      const response = await fetch(`${API}/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || 'Impossible de supprimer le compte.');
      }

      setStaff((current) => current.filter((member) => member.id !== id));
      setDeleteSuccess('Compte supprimé avec succès.');
    } catch (err: any) {
      setDeleteError(err.message || 'Erreur lors de la suppression.');
    } finally {
      setDeletingId(null);
    }
  };

  const openStoresEditor = (member: StaffMember) => {
    setStoresError('');
    setSelectedStoreIds((member.storeAssignments ?? []).map((a) => a.store.id));
    setEditingStoresFor(member);
  };

  const saveStoreAssignments = async () => {
    if (!editingStoresFor) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (selectedStoreIds.length === 0) {
      setStoresError('Sélectionnez au moins un magasin.');
      return;
    }

    setSavingStores(true);
    setStoresError('');

    try {
      const response = await fetch(`${API}/users/${editingStoresFor.id}/stores`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ storeIds: selectedStoreIds }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message || "Impossible de mettre à jour les magasins affectés.");
      }

      setStaff((current) =>
        current.map((member) => (member.id === data.id ? { ...member, ...data } : member)),
      );
      setEditingStoresFor(null);
    } catch (err: unknown) {
      setStoresError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour.');
    } finally {
      setSavingStores(false);
    }
  };

  // 2. RENDU DE LA PAGE UNE FOIS LES DONNÉES PRÊTES
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Staff administrateur</h1>
            <p className="mt-2 text-sm text-slate-600">
              Consultez les comptes Managers et Caissiers créés par votre compte pour chacun de vos magasins.
            </p>
          </div>
          <div className="space-x-2">
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>
              Retour au dashboard
            </Button>
            <Button onClick={() => window.location.reload()}>Rafraîchir</Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Vue d'ensemble du personnel</CardTitle>
              <CardDescription>
                Liste des comptes créés par votre compte Admin et affectés aux magasins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deleteError && <p className="mb-4 text-sm text-red-600">{deleteError}</p>}
              {deleteSuccess && <p className="mb-4 text-sm text-green-600">{deleteSuccess}</p>}

              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : staff.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun manager ni caissier créé pour le moment.</p>
              ) : (
                <div className="space-y-8">
                  {storeGroups.map((group) => (
                    <div key={group.storeName} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-slate-900">Magasin : {group.storeName}</h2>
                          <p className="text-sm text-slate-500">
                            {group.staff.length} compte{group.staff.length > 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="rounded-full bg-slate-50 px-3 py-1 text-sm text-slate-600">
                          {group.staff.filter((member) => member.role === 'MANAGER').length} Manager
                          {group.staff.filter((member) => member.role === 'MANAGER').length > 1 ? 's' : ''} •{' '}
                          {group.staff.filter((member) => member.role === 'CASHIER').length} Caissier
                          {group.staff.filter((member) => member.role === 'CASHIER').length > 1 ? 's' : ''}
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Rôle</TableHead>
                            <TableHead>Magasins</TableHead>
                            <TableHead>Créé le</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.staff.map((member) => (
                            <TableRow key={member.id}>
                              <TableCell>{member.name}</TableCell>
                              <TableCell>{member.email}</TableCell>
                              <TableCell className="font-semibold text-slate-700">{member.role}</TableCell>
                              <TableCell>
                                {(member.storeAssignments ?? []).length > 1 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {member.storeAssignments.map((a) => (
                                      <span
                                        key={a.store.id}
                                        className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                                      >
                                        {a.store.name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-sm text-slate-500">
                                    {member.storeAssignments?.[0]?.store?.name ?? '—'}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                {new Date(member.createdAt).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openStoresEditor(member)}
                                  >
                                    Magasins
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteStaff(member.id)}
                                    disabled={deletingId === member.id}
                                  >
                                    {deletingId === member.id ? 'Suppression...' : 'Supprimer'}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* MODAL D'AFFECTATION DES MAGASINS */}
      {editingStoresFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-bold">Magasins affectés</h2>
            <p className="mb-4 text-sm text-slate-500">
              {editingStoresFor.name} — {editingStoresFor.role === 'MANAGER' ? 'Manager' : 'Caissier'}
            </p>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
              {stores.length > 0 ? (
                stores.map((store) => (
                  <label key={store.id} className="flex items-center gap-3 py-1 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedStoreIds.includes(store.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedStoreIds((current) =>
                          checked ? [...current, store.id] : current.filter((id) => id !== store.id),
                        );
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>
                      {store.name}
                      {store.location ? ` — ${store.location}` : ''}
                    </span>
                  </label>
                ))
              ) : (
                <p className="text-xs text-gray-400">Aucun magasin disponible.</p>
              )}
            </div>

            {storesError && <p className="mt-3 text-sm text-red-600">{storesError}</p>}

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setEditingStoresFor(null)}
                disabled={savingStores}
              >
                Annuler
              </Button>
              <Button className="flex-1" onClick={saveStoreAssignments} disabled={savingStores}>
                {savingStores ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}