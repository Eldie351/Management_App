'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStockLabel, getStockStatus } from '@/lib/stock-status';

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId');

  // États pour les données
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // États pour le formulaire de création
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  const [minimumStock, setMinimumStock] = useState(5);
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // États pour le formulaire de recharge
  const [isRechargeModalOpen, setIsRechargeModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [rechargeQty, setRechargeQty] = useState<number>(0);
  const [rechargeError, setRechargeError] = useState('');
  const [isRecharging, setIsRecharging] = useState(false);

  // États pour le formulaire d'édition/modification
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editSku, setEditSku] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editDescription, setEditDescription] = useState('');
  const [editQuantity, setEditQuantity] = useState(0); 
  const [editMinimumStock, setEditMinimumStock] = useState(5);
  const [editError, setEditError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Fonction pour charger les produits
  const fetchProducts = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const url = storeId 
        ? `http://localhost:3001/products/store/${storeId}`
        : `http://localhost:3001/products/user/all`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Impossible de charger l’inventaire.');
      const data = await res.json();
      setProducts(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [storeId, router]);

  // Filtrage dynamique en temps réel
  const filteredProducts = products.filter((product) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      product.name?.toLowerCase().includes(query) ||
      product.sku?.toLowerCase().includes(query) ||
      product.description?.toLowerCase().includes(query)
    );
  });

  // Soumission du nouveau produit
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch('http://localhost:3001/products', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          sku: sku || undefined,
          quantity: Number(quantity),
          price: Number(price), 
          minimumStock: Number(minimumStock),
          description,
          storeId: Number(storeId),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Échec de l’ajout.');

      setName('');
      setSku('');
      setQuantity(0);
      setPrice(0);
      setMinimumStock(5);
      setDescription('');
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action pour envoyer les modifications du produit
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setIsEditing(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`http://localhost:3001/products/${editProduct.id}`, {
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
      setEditProduct(null);
      fetchProducts();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setIsEditing(false);
    }
  };

  // Action : Envoyer la recharge de stock
  const handleProcessRecharge = async (e: React.FormEvent) => {
    e.preventDefault();
    setRechargeError('');
    setIsRecharging(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`http://localhost:3001/products/${selectedProduct.id}/recharge`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity: Number(rechargeQty) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Échec de la recharge.');
      }

      setIsRechargeModalOpen(false);
      setRechargeQty(0);
      setSelectedProduct(null);
      fetchProducts();
    } catch (err: any) {
      setRechargeError(err.message);
    } finally {
      setIsRecharging(false);
    }
  };

  // Suppression d'un produit
  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Voulez-vous vraiment retirer ce produit du stock ?')) return;
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`http://localhost:3001/products/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Échec de la suppression');
      fetchProducts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-lg">Analyse de l’inventaire...</div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-500 font-semibold">{error}</div>;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {storeId ? 'Gestion du Stock' : 'Inventaire Global'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {storeId ? `Entrepôt référencé : #${storeId}` : 'Consultez la totalité des articles en stock'}
            </p>
          </div>
          <div className="space-x-4">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>← Tableau de bord</Button>
            {storeId && (
              <Button onClick={() => setIsModalOpen(true)}>+ Ajouter un Produit</Button>
            )}
          </div>
        </div>

        {/* Barre de recherche */}
        <div className="mb-6 max-w-md">
          <Input
            type="text"
            placeholder="🔍 Rechercher par désignation, description ou référence SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white shadow-sm h-10 border-gray-200 focus:border-blue-500"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inventaire Logistique</CardTitle>
            <CardDescription>Suivi précis des volumes, références, stocks de départ recalculés et dates d'entrée.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Désignation</TableHead>
                  {!storeId && <TableHead>Entrepôt</TableHead>}
                  <TableHead className="text-center">Stock Actuel</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Prix Unitaire</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <div>{product.name}</div>
                      {product.description && <span className="text-xs text-gray-400">{product.description}</span>}
                    </TableCell>
                    {!storeId && (
                      <TableCell className="font-semibold text-blue-600">
                        🏢 {product.store?.name || `Magasin #${product.storeId}`}
                      </TableCell>
                    )}

                    <TableCell className="text-center font-semibold">
                      <span className="text-sm text-gray-700">{product.quantity} unités</span>
                    </TableCell>

                    <TableCell className="text-center font-semibold">
                      {(() => {
                        const status = getStockStatus(product);
                        const statusInfo = getStockLabel(status);
                        return (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>
                        );
                      })()}
                    </TableCell>

                    <TableCell className="text-right font-mono font-bold">
                      {Number(product.sellingPrice ?? 0).toFixed(2)} <span className="text-xs text-blue-600 font-sans uppercase">{product.currency || 'XOF'}</span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-200 hover:bg-blue-50 text-blue-600 font-medium"
                        onClick={() => router.push(`/products/${product.id}`)}
                      >
                        Détails
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={storeId ? 7 : 8} className="text-center py-8 text-gray-400">
                      Aucun produit ne correspond à votre recherche.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* POPUP DE CRÉATION DE PRODUIT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <Card className="w-[500px] shadow-2xl bg-white animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <CardTitle>Ajouter un nouveau produit</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateProduct} className="space-y-4">
                {formError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded text-center">{formError}</p>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="prodName">Nom du produit *</Label>
                    <Input id="prodName" placeholder="Ex: Ordinateur Portable ASUS" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prodSku">Référence interne (SKU)</Label>
                    <Input id="prodSku" placeholder="Ex: ASUS-123" value={sku} onChange={(e) => setSku(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prodPrice">Prix Unitaire *</Label>
                    <div className="relative flex items-center">
                      <Input id="prodPrice" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} required className="pr-16" />
                      <span className="absolute right-3 text-xs font-bold text-slate-400 uppercase">
                        {products.length > 0 ? (products[0].currency || 'XOF') : 'XOF'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="prodQty">Quantité Initiale *</Label>
                    <Input id="prodQty" type="number" min="0" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="prodMinStock">Seuil minimum d’alerte</Label>
                    <Input id="prodMinStock" type="number" min="0" value={minimumStock} onChange={(e) => setMinimumStock(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="prodDesc">Description</Label>
                    <Input id="prodDesc" placeholder="Détails techniques, couleur..." value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={isSubmitting}>Valider l’entrée</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* POPUP DE MODIFICATION DE PRODUIT */}
      {isEditModalOpen && editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <Card className="w-[500px] shadow-2xl bg-white animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <CardTitle>Modifier la fiche produit</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProduct} className="space-y-4">
                {editError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded text-center">{editError}</p>}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="editProdName">Nom du produit *</Label>
                    <Input id="editProdName" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editProdSku">Référence interne (SKU)</Label>
                    <Input id="editProdSku" value={editSku} onChange={(e) => setEditSku(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="editProdPrice">Prix Unitaire *</Label>
                    <div className="relative flex items-center">
                      <Input id="editProdPrice" type="number" step="0.01" min="0" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} required className="pr-16" />
                      <span className="absolute right-3 text-xs font-bold text-slate-400 uppercase">
                        {editProduct.currency || 'XOF'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="editProdQty">Quantité actuelle en stock</Label>
                    <Input id="editProdQty" type="number" min="0" value={editQuantity} onChange={(e) => setEditQuantity(Number(e.target.value))} required />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="editProdMinStock">Seuil minimum d’alerte</Label>
                    <Input id="editProdMinStock" type="number" min="0" value={editMinimumStock} onChange={(e) => setEditMinimumStock(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="editProdDesc">Description</Label>
                    <Input id="editProdDesc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsEditModalOpen(false);
                    setEditProduct(null);
                  }}>Annuler</Button>
                  <Button type="submit" disabled={isEditing}>Enregistrer les modifications</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* POPUP DE RECHARGE DE STOCK */}
      {isRechargeModalOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <Card className="w-[400px] shadow-2xl bg-white animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <CardTitle>Réapprovisionnement</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProcessRecharge} className="space-y-4">
                {rechargeError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded text-center">{rechargeError}</p>}
                
                <div className="bg-gray-50 p-3 rounded-lg border text-sm space-y-1.5 mb-2">
                  <div className="flex justify-between"><span className="text-gray-500">Stock actuel :</span> <span className="font-semibold">{selectedProduct.quantity} u.</span></div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rechargeQtyInput">Quantité à ajouter</Label>
                  <Input id="rechargeQtyInput" type="number" min="1" value={rechargeQty} onChange={(e) => setRechargeQty(Number(e.target.value))} required />
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsRechargeModalOpen(false);
                    setSelectedProduct(null);
                  }}>Annuler</Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isRecharging}>Confirmer</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-lg">Initialisation de l’interface...</div>}>
      <ProductsContent />
    </Suspense>
  );
}