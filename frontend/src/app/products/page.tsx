'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId');

  // États pour les données
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // États pour le formulaire de création
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fonction pour charger les produits
  const fetchProducts = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const url = storeId 
        ? `http://localhost:3000/products/store/${storeId}`
        : `http://localhost:3000/products/user/all`;

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

  // Soumission du nouveau produit
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch('http://localhost:3000/products', {
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
      setDescription('');
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Suppression d'un produit
  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Voulez-vous vraiment retirer ce produit du stock ?')) return;
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`http://localhost:3000/products/${id}`, {
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

        <Card>
          <CardHeader>
            <CardTitle>Inventaire Logistique</CardTitle>
            <CardDescription>Suivi précis des volumes, références, stocks de départ et dates d'entrée.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Désignation</TableHead>
                  <TableHead>Réf (SKU)</TableHead>
                  {!storeId && <TableHead>Entrepôt</TableHead>}
                  <TableHead className="text-center">Stock de Départ</TableHead>
                  <TableHead className="text-center">Stock Actuel</TableHead>
                  <TableHead className="text-center">Date d'Entrée</TableHead>
                  <TableHead className="text-right">Prix Unitaire</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <div>{product.name}</div>
                      {product.description && <span className="text-xs text-gray-400">{product.description}</span>}
                    </TableCell>
                    <TableCell className="text-gray-500 font-mono text-xs">{product.sku || 'N/A'}</TableCell>
                    
                    {!storeId && (
                      <TableCell className="font-semibold text-blue-600">
                        🏢 {product.store?.name || `Magasin #${product.storeId}`}
                      </TableCell>
                    )}

                    <TableCell className="text-center text-gray-500 font-medium">
                      {product.initialStock ?? product.quantity} u.
                    </TableCell>

                    <TableCell className="text-center font-semibold">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs ${product.quantity > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {product.quantity} unités
                      </span>
                    </TableCell>

                    <TableCell className="text-center text-xs text-gray-500">
                      {product.createdAt ? new Date(product.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      }) : 'N/A'}
                    </TableCell>

                    <TableCell className="text-right font-mono">{Number(product.price).toFixed(2)} €</TableCell>
                    <TableCell className="text-right">
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteProduct(product.id)}>
                        Supprimer
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {products.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={storeId ? 7 : 8} className="text-center py-8 text-gray-400">
                      Aucun produit enregistré.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      {/* POPUP FORMULAIRE PRODUIT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <Card className="w-[500px] shadow-2xl bg-white animate-in fade-in zoom-in duration-200">
            <CardHeader>
              <CardTitle>Ajouter un nouveau produit</CardTitle>
              <CardDescription>Remplissez la fiche produit pour l'injecter dans l'entrepôt.</CardDescription>
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
                    <Label htmlFor="prodPrice">Prix Unitaire (€) *</Label>
                    <Input id="prodPrice" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
                  </div>
                                    <div className="space-y-2 col-span-2">
                    <Label htmlFor="prodQty">Quantité Initiale *</Label>
                    <Input id="prodQty" type="number" min="0" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="prodDesc">Description</Label>
                    <Input id="prodDesc" placeholder="Détails techniques, couleur..." value={description} onChange={(e) => setDescription(e.target.value)} />
                  </div>
                </div>
                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                  <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Annuler</Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Insertion...' : 'Valider l’entrée'}
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

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-lg">Initialisation de l’interface...</div>}>
      <ProductsContent />
    </Suspense>
  );
}
