'use client';

import { useEffect, useState } from 'react';
import { getStoredUserRole } from '@/lib/auth';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getStockLabel, getStockStatus } from '@/lib/stock-status';

interface ProductDetailsResponse {
  general: {
    name: string;
    sku?: string | null;
    description?: string | null;
    price?: number | null;
    createdAt?: string;
    updatedAt?: string;
  };
  stock: {
    currentStock: number;
    initialStock?: number | null;
    minimumStock?: number | null;
    stockValue: number;
    status: 'Rupture' | 'Faible' | 'Normal';
  };
  stats: {
    totalSold: number;
    salesCount: number;
    totalRecharged: number;
    rechargesCount: number;
    lastSaleDate?: string | null;
    lastRechargeDate?: string | null;
  };
  history: Array<{
    type: string;
    typeLabel: string;
    quantity: number;
    date: string;
    note?: string | null;
  }>;
  store: {
    name: string;
    currency: string;
  };
}

export default function ProductDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id;

  const [details, setDetails] = useState<ProductDetailsResponse | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editDescription, setEditDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState(0);
  const [editMinimumStock, setEditMinimumStock] = useState(5);
  const [editError, setEditError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [rechargeQty, setRechargeQty] = useState(0);
  const [rechargeError, setRechargeError] = useState('');
  const [isRecharging, setIsRecharging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    setRole(getStoredUserRole());
    const fetchDetails = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch(`http://localhost:3001/products/${productId}/details`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || 'Impossible de charger les détails du produit.');
        }

        const data = await res.json();
        setDetails(data);
        setEditName(data.general.name || '');
        setEditSku(data.general.sku || '');
        setEditPrice(Number(data.general.price ?? 0));
        setEditDescription(data.general.description || '');
        setEditQuantity(data.stock.currentStock ?? 0);
        setEditMinimumStock(data.stock.minimumStock ?? 5);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchDetails();
    }
  }, [productId, router]);

  // If the user is a cashier, forbid access to the product details page
  useEffect(() => {
    if (role === 'CASHIER') {
      router.push('/products');
    }
  }, [role, router]);

  const handleDeleteProduct = async () => {
    if (!productId) return;

    const confirmed = window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?');
    if (!confirmed) return;

    setDeleteError('');
    setIsDeleting(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`http://localhost:3001/products/${productId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Échec de la suppression.');

      router.push('/products');
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setIsEditing(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`http://localhost:3001/products/${productId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editName,
          sku: editSku || null,
          price: Number(editPrice),
          description: editDescription || null,
          quantity: Number(editQuantity),
          minimumStock: Number(editMinimumStock),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Échec de la modification.');

      setIsEditModalOpen(false);
      const refreshed = await fetch(`http://localhost:3001/products/${productId}/details`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (refreshed.ok) {
        const updated = await refreshed.json();
        setDetails(updated);
      }
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setIsEditing(false);
    }
  };

  const handleRechargeProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setRechargeError('');
    setIsRecharging(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`http://localhost:3001/products/${productId}/recharge`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity: Number(rechargeQty) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Échec du rechargement.');

      setIsRechargeModalOpen(false);
      setRechargeQty(0);
      const refreshed = await fetch(`http://localhost:3001/products/${productId}/details`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (refreshed.ok) {
        const updated = await refreshed.json();
        setDetails(updated);
      }
    } catch (err: any) {
      setRechargeError(err.message);
    } finally {
      setIsRecharging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center text-lg">Chargement de la fiche produit...</main>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <p className="text-red-600 font-semibold">{error || 'Produit introuvable.'}</p>
          <Button variant="outline" onClick={() => router.push('/products')}>Retour à l’inventaire</Button>
        </main>
      </div>
    );
  }

  const status = getStockStatus({
    quantity: details.stock.currentStock,
    minimumStock: details.stock.minimumStock ?? 5,
  });
  const statusInfo = getStockLabel(status);
  const stockBadgeClass = statusInfo.className;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{details.general.name}</h1>
            <p className="text-muted-foreground mt-1">Fiche détaillée • {details.store.name}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/products')}>← Retour à l’inventaire</Button>
            {role !== 'CASHIER' && (
              <>
                <Button onClick={() => setIsEditModalOpen(true)}>Modifier</Button>
                <Button variant="secondary" onClick={() => setIsRechargeModalOpen(true)}>Recharger</Button>
                <Button variant="destructive" onClick={handleDeleteProduct} disabled={isDeleting}>
                  {isDeleting ? 'Suppression...' : 'Supprimer'}
                </Button>
              </>
            )}
          </div>
        </div>

        {deleteError && <p className="mb-4 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{deleteError}</p>}

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
              <CardDescription>Identité du produit et contexte d’entrée en stock.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Nom</p>
                <p className="font-semibold">{details.general.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">SKU</p>
                <p className="font-semibold">{details.general.sku || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Seuil minimum d’alerte</p>
                <p className="font-semibold">{details.stock.minimumStock ?? 5}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Prix de vente</p>
                <p className="font-semibold">{Number(details.general.price ?? 0).toFixed(2)} {details.store.currency}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Magasin</p>
                <p className="font-semibold">{details.store.name}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-500">Description</p>
                <p className="font-semibold">{details.general.description || 'Aucune description.'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Créé le</p>
                <p className="font-semibold">{details.general.createdAt ? new Date(details.general.createdAt).toLocaleString('fr-FR') : 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Mis à jour le</p>
                <p className="font-semibold">{details.general.updatedAt ? new Date(details.general.updatedAt).toLocaleString('fr-FR') : 'N/A'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>État du stock</CardTitle>
              <CardDescription>Vue rapide de la disponibilité et de la valeur.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Statut</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${stockBadgeClass}`}>{statusInfo.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Stock actuel</span>
                <span className="font-semibold">{details.stock.currentStock} unités</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Stock initial</span>
                <span className="font-semibold">{details.stock.initialStock ?? 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Seuil minimum</span>
                <span className="font-semibold">{details.stock.minimumStock ?? 5}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Valeur en stock</span>
                <span className="font-semibold">{Number(details.stock.stockValue ?? 0).toFixed(2)} {details.store.currency}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 mt-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Statistiques</CardTitle>
              <CardDescription>Ventes et réapprovisionnements associés.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Unités vendues</span>
                <span className="font-semibold">{details.stats.totalSold}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Nombre de ventes</span>
                <span className="font-semibold">{details.stats.salesCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Unités réapprovisionnées</span>
                <span className="font-semibold">{details.stats.totalRecharged}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Nombre de réapprovisionnements</span>
                <span className="font-semibold">{details.stats.rechargesCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Dernière vente</span>
                <span className="font-semibold">{details.stats.lastSaleDate ? new Date(details.stats.lastSaleDate).toLocaleString('fr-FR') : 'Aucune'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Dernier rechargement</span>
                <span className="font-semibold">{details.stats.lastRechargeDate ? new Date(details.stats.lastRechargeDate).toLocaleString('fr-FR') : 'Aucun'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historique des mouvements</CardTitle>
              <CardDescription>Évolution du stock et actions associées.</CardDescription>
            </CardHeader>
            <CardContent>
              {details.history.length === 0 ? (
                <p className="text-sm text-gray-500">Aucun mouvement enregistré pour ce produit.</p>
              ) : (
                <div className="space-y-3">
                  {details.history.map((entry, index) => (
                    <div key={`${entry.type}-${entry.date}-${index}`} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{entry.typeLabel}</span>
                        <span className={`text-sm ${entry.quantity >= 0 ? 'text-emerald-600' : 'text-red-600'}`}> {entry.quantity > 0 ? '+' : ''}{entry.quantity}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{entry.note || 'Aucune remarque'}</p>
                      <p className="text-xs text-gray-400 mt-1">{new Date(entry.date).toLocaleString('fr-FR')}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <Card className="w-[500px] shadow-2xl bg-white">
            <CardHeader>
              <CardTitle>Modifier le produit</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProduct} className="space-y-4">
                {editError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded text-center">{editError}</p>}
                <div className="space-y-2">
                  <Label htmlFor="editName">Nom</Label>
                  <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editSku">SKU</Label>
                  <Input id="editSku" value={editSku} onChange={(e) => setEditSku(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editPrice">Prix de vente</Label>
                  <Input id="editPrice" type="number" step="0.01" min="0" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editQuantity">Quantité en stock</Label>
                  <Input id="editQuantity" type="number" min="0" value={editQuantity} onChange={(e) => setEditQuantity(Number(e.target.value))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editMinStock">Seuil minimum d’alerte</Label>
                  <Input id="editMinStock" type="number" min="0" value={editMinimumStock} onChange={(e) => setEditMinimumStock(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editDescription">Description</Label>
                  <Input id="editDescription" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={isEditing}>{isEditing ? 'Enregistrement...' : 'Enregistrer'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {isRechargeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <Card className="w-[400px] shadow-2xl bg-white">
            <CardHeader>
              <CardTitle>Réapprovisionner le produit</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRechargeProduct} className="space-y-4">
                {rechargeError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded text-center">{rechargeError}</p>}
                <div className="space-y-2">
                  <Label htmlFor="rechargeQty">Quantité à ajouter</Label>
                  <Input id="rechargeQty" type="number" min="1" value={rechargeQty} onChange={(e) => setRechargeQty(Number(e.target.value))} required />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setIsRechargeModalOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={isRecharging}>{isRecharging ? 'Traitement...' : 'Confirmer'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
