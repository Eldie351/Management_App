'use client';

import { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStoredUserRole } from '@/lib/auth';
import { useRouter } from 'next/navigation';

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
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

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
        const response = await fetch('http://localhost:3001/users/staff', {
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

    fetchStaff();
  }, [router]);

  const staffByStore = staff.reduce<Record<string, StaffMember[]>>((groups, member) => {
    const key = member.storeAssignments?.[0]?.store?.name || 'Non assigné';
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(member);
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
      const response = await fetch(`http://localhost:3001/users/${id}`, {
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

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Staff administrateur</h1>
            <p className="mt-2 text-sm text-slate-600">Consultez les comptes Managers et Caissiers créés par votre compte pour chacun de vos magasins.</p>
          </div>
          <div className="space-x-2">
            <Button variant="secondary" onClick={() => router.push('/dashboard')}>Retour au dashboard</Button>
            <Button onClick={() => window.location.reload()}>Rafraîchir</Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Vue d'ensemble du personnel</CardTitle>
              <CardDescription>Liste des comptes créés par votre compte Admin et affectés aux magasins.</CardDescription>
            </CardHeader>
            <CardContent>
              {deleteError && <p className="mb-4 text-sm text-red-600">{deleteError}</p>}
              {deleteSuccess && <p className="mb-4 text-sm text-green-600">{deleteSuccess}</p>}
              {loading ? (
                <p className="text-sm text-slate-500">Chargement des comptes en cours…</p>
              ) : error ? (
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
                          <p className="text-sm text-slate-500">{group.staff.length} compte{group.staff.length > 1 ? 's' : ''}</p>
                        </div>
                        <div className="rounded-full bg-slate-50 px-3 py-1 text-sm text-slate-600">
                          {group.staff.filter((member) => member.role === 'MANAGER').length} Manager{group.staff.filter((member) => member.role === 'MANAGER').length > 1 ? 's' : ''} • {group.staff.filter((member) => member.role === 'CASHIER').length} Caissier{group.staff.filter((member) => member.role === 'CASHIER').length > 1 ? 's' : ''}
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nom</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Rôle</TableHead>
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
                              <TableCell>{new Date(member.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteStaff(member.id)}
                                  disabled={deletingId === member.id}
                                >
                                  {deletingId === member.id ? 'Suppression...' : 'Supprimer'}
                                </Button>
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
    </div>
  );
}
