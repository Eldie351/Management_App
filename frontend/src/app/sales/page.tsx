'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SalesPage() {
  const router = useRouter();
  
  // États pour les données
  const [profile, setProfile] = useState<any>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [storeProducts, setStoreProducts] = useState<any[]>([]);
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // États pour le formulaire de vente
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantityToSell, setQuantityToSell] = useState<number>(1);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // États pour la barre de recherche de référence interne
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const stores = Array.isArray(profile?.stores)
    ? profile.stores
    : profile?.stores
    ? [profile.stores]
    : [];

  // 1. Charger le profil pour obtenir les magasins de l'utilisateur
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
      .then((res) => {
        if (!res.ok) throw new Error('Session expirée');
        return res.json();
      })
      .then((data) => {
        console.log('Profile reçu du backend:', data);
        if (data.stores) {
          console.log('Stores disponibles:', JSON.stringify(data.stores, null, 2));
        }
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('access_token');
        router.push('/login');
      });
  }, [router]);

  const fetchProductsForStore = async (storeId: string) => {
    if (!storeId) {
      setStoreProducts([]);
      return;
    }
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`http://localhost:3001/products/store/${storeId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setStoreProducts(data);
      setSelectedProductId('');
      setProductSearchQuery('');
    } catch (err) {
      console.error('Erreur chargement produits:', err);
    }
  };

  const fetchSalesHistory = async (storeId: string) => {
    if (!storeId) return;
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`http://localhost:3001/products/store/${storeId}/sales`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setSalesHistory(Array.isArray(data) ? data : []); 
    } catch (err) {
      console.error("Erreur chargement historique:", err);
    }
  };

  useEffect(() => {
    if (selectedStoreId) {
      fetchProductsForStore(selectedStoreId);
      fetchSalesHistory(selectedStoreId);
    }
  }, [selectedStoreId]);

  const handleSelectStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    setFormError('');
  };

  // Extraction dynamique et sécurisée de la monnaie de l'entrepôt courant
  const currentStoreObj = stores.find((s: any) => s.id.toString() === selectedStoreId.toString());
  const storeCurrency = currentStoreObj?.currency || 'XOF';

  // Filtrage dynamique des produits dans le formulaire
  const filteredProductOptions = storeProducts.filter((p) => {
    const query = productSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      p.name?.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query)
    );
  });

  const currentSelectedProductObj = storeProducts.find(p => p.id.toString() === selectedProductId);

  // Validation et enregistrement d'une vente
  const handleProcessSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedProductId) {
      setFormError('Veuillez sélectionner un produit dans la liste.');
      return;
    }

    setIsSubmitting(true);
    const product = currentSelectedProductObj;

    if (!product) {
      setFormError('Produit introuvable.');
      setIsSubmitting(false);
      return;
    }

    if (quantityToSell > product.quantity) {
      setFormError(`Stock insuffisant. Quantité disponible : ${product.quantity} unités.`);
      setIsSubmitting(false);
      return;
    }

    const token = localStorage.getItem('access_token');
    
    try {
      const response = await fetch(`http://localhost:3001/products/${selectedProductId}/stock`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ quantity: quantityToSell }),
      });

      const updatedData = await response.json();
      if (!response.ok) throw new Error(updatedData.message || 'Échec de la transaction.');

      await fetchProductsForStore(selectedStoreId);
      await fetchSalesHistory(selectedStoreId);
      
      setQuantityToSell(1);
      setSelectedProductId('');
      setProductSearchQuery('');
      alert('Vente enregistrée avec succès dans la base de données !');
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Initialisation du registre...</div>;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        {!selectedStoreId ? (
          <div className="space-y-6">
            <div className="border-b pb-4 mb-6">
              <h1 className="text-3xl font-bold tracking-tight">Choisissez votre magasin</h1>
              <p className="text-muted-foreground mt-1">Sélectionnez d'abord un magasin pour commencer à enregistrer des ventes.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stores.length > 0 ? (
                stores.map((store: any) => (
                  <Card key={store.id} className="cursor-pointer hover:border-blue-500 hover:shadow-lg transition-shadow" onClick={() => handleSelectStore(store.id.toString())}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{store.name}</CardTitle>
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 border border-blue-200">
                          {store.currency || 'XOF'}
                        </span>
                      </div>
                      <CardDescription>{store.location || 'Localisation non renseignée'}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-gray-600">
                        <p className="mt-2 text-xs text-muted-foreground">Cliquez pour ouvrir ce magasin</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent>
                    <p className="text-sm text-gray-600">Aucun magasin associé à votre compte. Veuillez en créer un pour commencer.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b pb-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Registre des Ventes</h1>
                <p className="text-muted-foreground mt-1">Magasin sélectionné : <strong>{currentStoreObj?.name || '—'}</strong> <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-200 ml-2">{storeCurrency}</span></p>
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedStoreId('')}>
                  Changer de magasin
                </Button>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Nouvelle Sortie de Stock</CardTitle>
                  <CardDescription>Recherchez et sélectionnez l'article vendu.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProcessSale} className="space-y-4">
                {formError && <p className="text-sm text-red-500 bg-red-50 p-2 rounded text-center font-medium">{formError}</p>}

                <div className="space-y-2 relative">
                  <Label htmlFor="productSearchInput">Sélectionner la référence</Label>
                  <Input
                    id="productSearchInput"
                    type="text"
                    placeholder="🔍 Taper le nom ou SKU du produit..."
                    value={productSearchQuery}
                    onChange={(e) => {
                      setProductSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="w-full bg-white text-sm"
                    autoComplete="off"
                  />

                  {currentSelectedProductObj && (
                    <div className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1.5 rounded-md mt-1 flex justify-between items-center">
                      <span>Sélectionné : <strong>{currentSelectedProductObj.name}</strong></span>
                      <button 
                        type="button" 
                        onClick={() => { setSelectedProductId(''); setProductSearchQuery(''); }} 
                        className="text-blue-500 hover:text-blue-700 font-bold ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {isDropdownOpen && (
                    <div className="absolute left-0 right-0 z-30 max-h-52 overflow-y-auto border border-gray-200 bg-white rounded-lg shadow-xl mt-1 divide-y divide-gray-50">
                      {filteredProductOptions.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedProductId(p.id.toString());
                            setProductSearchQuery(p.name);
                            setIsDropdownOpen(false);
                          }}
                          className={`p-2.5 text-xs cursor-pointer flex justify-between items-center transition-colors ${
                                                        selectedProductId === p.id.toString() ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{p.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">SKU: {p.sku || 'N/A'}</span>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            <span className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${p.quantity > 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              {p.quantity} dispo
                            </span>
                            <span className="text-gray-500 font-mono mt-0.5">{Number(p.price).toFixed(2)} {storeCurrency}</span>
                          </div>
                        </div>
                      ))}

                      {filteredProductOptions.length === 0 && (
                        <div className="p-3 text-center text-xs text-gray-400 bg-gray-50">
                          Aucun article ne correspond à votre recherche.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {isDropdownOpen && (
                  <div className="fixed inset-0 z-20" onClick={() => setIsDropdownOpen(false)} />
                )}

                <div className="space-y-2">
                  <Label htmlFor="saleQty">Quantité vendue</Label>
                  <Input
                    id="saleQty"
                    type="number"
                    min="1"
                    value={quantityToSell}
                    onChange={(e) => setQuantityToSell(Number(e.target.value))}
                    required
                  />
                </div>

                <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-medium h-10" disabled={isSubmitting || !selectedProductId}>
                  {isSubmitting ? 'Traitement...' : 'Valider la transaction'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Flux de Transactions Récents</CardTitle>
              <CardDescription>Historique permanent des ventes effectuées lues depuis PostgreSQL.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date / Heure</TableHead>
                    <TableHead>Article</TableHead>
                    <TableHead className="text-center">Quantité</TableHead>
                    <TableHead className="text-right">Chiffre d'Affaires</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesHistory.map((sale) => (
                    <TableRow key={sale.id} className="bg-green-50/10">
                      <TableCell className="font-mono text-xs text-gray-500">
                        {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) : 'Maintenant'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-gray-800">{sale.productName}</div>
                        {sale.sku && <span className="text-xs font-mono text-gray-400">SKU: {sale.sku}</span>}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-red-600">-{sale.quantity}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-green-600">
                        +{Number(sale.total).toFixed(2)} {storeCurrency}
                      </TableCell>
                    </TableRow>
                  ))}

                  {salesHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-gray-400">
                        Aucune vente enregistrée pour cet entrepôt dans PostgreSQL.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
