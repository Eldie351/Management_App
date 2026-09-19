'use client';

import { useEffect, useState, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoadingDots } from '@/components/ui/loading_dots';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getStoredUserRole } from '@/lib/auth';
import { escapeHtml } from '@/lib/html';
import { FileText, Printer } from 'lucide-react';

function ProductsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storeId = searchParams.get('storeId');
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const [role, setRole] = useState<string | null>(null);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(storeId);
  const [storeName, setStoreName] = useState<string | null>(null);

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
  // Produits existants dont le nom contient exactement les mêmes mots,
  // dans un ordre différent (ex : "Portable 1" / "1 Portable") — avertit
  // sans bloquer, contrairement à un doublon exact.
  const [similarProducts, setSimilarProducts] = useState<any[]>([]);
  const [isCheckingSimilar, setIsCheckingSimilar] = useState(false);

  // États pour l'export / impression de la liste des produits
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [exportError, setExportError] = useState('');

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
  const [editQuantity, setEditQuantity] = useState(0);
  const [editDescription, setEditDescription] = useState('');
  const [editMinimumStock, setEditMinimumStock] = useState(5);
  const [editError, setEditError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Fonction pour charger les produits
  const fetchProducts = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const userRole = getStoredUserRole();
      setRole(userRole);

      let currentStoreId = storeId;

      // Uniquement si AUCUN storeId n'est présent dans l'URL ET que l'utilisateur est un CAISSIER
      if (!currentStoreId && userRole === 'CASHIER') {
        const profileRes = await fetch(`${API}/auth/profil`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });

        if (profileRes.ok) {
          const profile = await profileRes.json();
          const assignedId = profile?.assignedStore?.id ?? profile?.assignedStoreId;
          if (assignedId) {
            currentStoreId = String(assignedId);
          }
        }
      }

      setActiveStoreId(currentStoreId);

      // Si currentStoreId existe -> /products/store/:id
      // Sinon (page globale pour les administrateurs) -> /products/user/all
      const url = currentStoreId
        ? `${API}/products/store/${currentStoreId}`
        : `${API}/products/user/all`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Impossible de charger l’inventaire.');
      const data = await res.json();
      setProducts(Array.isArray(data) ? data : data?.data ?? []);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des produits.');
      setLoading(false);
    }
  }, [API, router, storeId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Récupère le nom du magasin sélectionné (l'ID seul n'est pas parlant pour l'utilisateur).
  useEffect(() => {
    const targetStoreId = storeId || activeStoreId;
    if (!targetStoreId) {
      setStoreName(null);
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) return;

    let cancelled = false;
    fetch(`${API}/stores/${targetStoreId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setStoreName(data?.name ?? null);
      })
      .catch(() => {
        if (!cancelled) setStoreName(null);
      });

    return () => {
      cancelled = true;
    };
  }, [API, storeId, activeStoreId]);

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

  // Envoie effectivement la création du produit au backend.
  const submitProductCreation = async () => {
    setIsSubmitting(true);
    const token = localStorage.getItem('access_token');
    const targetStoreId = storeId || activeStoreId;

    try {
      const res = await fetch(`${API}/products`, {
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
          storeId: targetStoreId ? Number(targetStoreId) : undefined,
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
      setSimilarProducts([]);
      setIsModalOpen(false);
      fetchProducts();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Soumission du formulaire : avant de créer, vérifie s'il existe déjà un
  // produit avec exactement les mêmes mots dans un ordre différent. Si oui,
  // affiche un avertissement et attend une confirmation explicite avant de
  // créer réellement (le bouton "Créer quand même" ré-appelle cette même
  // fonction avec `similarProducts` déjà rempli, donc la vérification est
  // sautée et la création se fait directement).
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const targetStoreId = storeId || activeStoreId;

    if (similarProducts.length === 0 && targetStoreId) {
      setIsCheckingSimilar(true);
      try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(
          `${API}/products/store/${targetStoreId}/similar-names?name=${encodeURIComponent(name)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (res.ok) {
          const similar = await res.json();
          if (Array.isArray(similar) && similar.length > 0) {
            setSimilarProducts(similar);
            setIsCheckingSimilar(false);
            return;
          }
        }
      } catch {
        // Vérification purement informative : en cas d'échec, on ne bloque pas la création.
      }
      setIsCheckingSimilar(false);
    }

    await submitProductCreation();
  };

  // Export de la liste des produits du magasin en PDF (téléchargé depuis le backend)
  const handleExportPdf = async () => {
    const targetStoreId = storeId || activeStoreId;
    if (!targetStoreId) return;

    setExportError('');
    setIsExportingPdf(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`${API}/products/store/${targetStoreId}/export/pdf`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Échec de l'export PDF de l'inventaire.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      setExportError(err.message || "Erreur lors de l'export PDF.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Impression directe de la liste des produits actuellement affichée
  const handlePrintList = () => {
    setExportError('');
    setIsPrinting(true);

    // BUGFIX : la fiche imprimée doit être identique au PDF généré par le
    // backend (ProductsExportService.generateProductsPdf) — mêmes colonnes
    // (Désignation / Stock Actuel / Prix Unitaire), même titre, et surtout
    // le même contenu : l'inventaire complet du magasin, indépendamment du
    // filtre de recherche actif à l'écran (on utilise `products`, pas
    // `filteredProducts`).
    const targetStoreId = storeId || activeStoreId;
    const title = targetStoreId
      ? `Liste des produits — ${storeName || `Magasin #${targetStoreId}`}`
      : 'Liste des produits — Tous magasins';
    const printedAt = new Date().toLocaleString('fr-FR');

    const rows = products
      .map((p) => {
        const currency = p.currency || p.store?.currency || 'XOF';
        const price = Number(p.sellingPrice ?? p.price ?? 0).toFixed(2);
        return `
          <tr>
            <td>${escapeHtml(p.name ?? '')}</td>
            <td class="text-center">${escapeHtml(p.quantity ?? 0)}</td>
            <td class="text-right">${escapeHtml(price)} ${escapeHtml(currency)}</td>
          </tr>
        `;
      })
      .join('');

    const html = `
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #ddd; padding: 6px 8px; }
            th { background: #f3f4f6; text-align: left; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <p class="meta">Imprimé le ${escapeHtml(printedAt)} — ${escapeHtml(products.length)} produit(s)</p>
          <table>
            <thead>
              <tr>
                <th>Désignation</th>
                <th class="text-center">Stock Actuel</th>
                <th class="text-right">Prix Unitaire</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="3" class="text-center">Aucun produit</td></tr>`}
            </tbody>
          </table>
        </body>
      </html>
    `;

    const w = window.open('', '_blank', 'width=900,height=1000');
    if (!w) {
      setExportError("Impossible d'ouvrir la fenêtre d'impression (bloquée par le navigateur ?).");
      setIsPrinting(false);
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
      setIsPrinting(false);
    }, 300);
  };

  // Action pour envoyer les modifications du produit
  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    setIsEditing(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`${API}/products/${editProduct.id}`, {
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
      const res = await fetch(`${API}/products/${selectedProduct.id}/recharge`, {
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

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100">
        <LoadingDots/>
      </div>
    );
  }

  if (error) return <div className="flex h-screen items-center justify-center text-red-500 font-semibold">{error}</div>;

  const currentEffectiveStoreId = storeId || activeStoreId;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {currentEffectiveStoreId ? 'Gestion du Stock' : 'Inventaire Global'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {currentEffectiveStoreId
                ? `Entrepôt : ${storeName || `Magasin #${currentEffectiveStoreId}`}`
                : 'Consultez la totalité des articles en stock'}
            </p>
          </div>
          <div className="space-x-4">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>← Tableau de bord</Button>
            {currentEffectiveStoreId && (
              <>
                <Button
                  variant="outline"
                  onClick={handlePrintList}
                  disabled={isPrinting}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  {isPrinting ? 'Impression…' : 'Imprimer'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {isExportingPdf ? 'Génération…' : 'Exporter en PDF'}
                </Button>
                {role !== 'CASHIER' && (
                  <Button
                    onClick={() => {
                      setSimilarProducts([]);
                      setFormError('');
                      setIsModalOpen(true);
                    }}
                  >
                    + Ajouter un Produit
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {exportError && (
          <div className="mb-4 rounded-md bg-red-50 border border-red-200 text-red-600 text-sm p-3">
            {exportError}
          </div>
        )}

        {/* Barre de recherche */}
        <div className="mb-6 max-w-md">
          <Input
            type="text"
            placeholder="Rechercher par désignation, description ou référence SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white shadow-sm h-10 border-gray-200 focus:border-blue-500"
          />
        </div>

        {/* Total produits affichés */}
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Total produits affichés: <span className="font-semibold">{filteredProducts.length}</span> / <span className="text-muted-foreground">{products.length}</span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inventaire Logistique</CardTitle>
            <CardDescription>Suivi précis des volumes, références et statuts de stock.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Désignation</TableHead>
                  {(!currentEffectiveStoreId || currentEffectiveStoreId === 'all') && (
                    <TableHead>Entrepôt</TableHead>
                  )}
                  <TableHead className="text-center">Stock Actuel</TableHead>
                  <TableHead className="text-right">Prix Unitaire</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <div>{product.name}</div>
                      {product.description && (
                        <span className="text-xs text-gray-400">{product.description}</span>
                      )}
                    </TableCell>
                    {(!currentEffectiveStoreId || currentEffectiveStoreId === 'all') && (
                      <TableCell className="font-semibold text-blue-600">
                        {product.store?.name || (product.storeId ? `Magasin #${product.storeId}` : '—')}
                      </TableCell>
                    )}

                    <TableCell className="text-center font-semibold">
                      <span className="text-sm text-gray-700">{product.quantity} unités</span>
                    </TableCell>

                    <TableCell className="text-right font-mono font-bold">
                      {Number(product.sellingPrice ?? product.price ?? 0).toFixed(2)}{' '}
                      <span className="text-xs text-blue-600 font-sans uppercase">
                        {product.currency || product.store?.currency || 'XOF'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {role !== 'CASHIER' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-200 hover:bg-blue-50 text-blue-600 font-medium"
                          onClick={() => router.push(`/products/${product.id}`)}
                        >
                          Détails
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {filteredProducts.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={currentEffectiveStoreId && currentEffectiveStoreId !== 'all' ? 4 : 5}
                      className="text-center py-8 text-gray-400"
                    >
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
                    <Input
                      id="prodName"
                      placeholder="Ex: Ordinateur Portable ASUS"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (similarProducts.length > 0) setSimilarProducts([]);
                      }}
                      required
                    />
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

                {similarProducts.length > 0 && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 space-y-2">
                    <p className="font-medium">
                      Un ou plusieurs produits existants portent exactement les mêmes mots, dans un ordre différent :
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {similarProducts.map((p) => (
                        <li key={p.id}>
                          <span className="font-semibold">{p.name}</span>
                          {p.sku ? ` (SKU: ${p.sku})` : ''} — {p.quantity} unité(s) en stock
                        </li>
                      ))}
                    </ul>
                    <p>Voulez-vous quand même créer &quot;{name}&quot; comme un nouveau produit distinct ?</p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                  <Button type="button" variant="outline" onClick={() => { setSimilarProducts([]); setIsModalOpen(false); }}>Annuler</Button>
                  {similarProducts.length > 0 && (
                    <Button type="button" variant="outline" onClick={() => setSimilarProducts([])}>
                      Modifier le nom
                    </Button>
                  )}
                  <Button type="submit" disabled={isSubmitting || isCheckingSimilar}>
                    {isCheckingSimilar
                      ? 'Vérification…'
                      : similarProducts.length > 0
                        ? 'Créer quand même'
                        : 'Valider l’entrée'}
                  </Button>
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
                    <Input 
                      id="editProdName" 
                      value={editName} 
                      onChange={(e) => setEditName(e.target.value)} 
                      required 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editProdSku">Référence interne (SKU)</Label>
                    <Input 
                      id="editProdSku" 
                      value={editSku} 
                      onChange={(e) => setEditSku(e.target.value)} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="editProdPrice">Prix Unitaire *</Label>
                    <div className="relative flex items-center">
                      <Input 
                        id="editProdPrice" 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        value={editPrice} 
                        onChange={(e) => setEditPrice(Number(e.target.value))} 
                        required 
                        className="pr-16" 
                      />
                      <span className="absolute right-3 text-xs font-bold text-slate-400 uppercase">
                        {editProduct.currency || 'XOF'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="editProdQuantity">Quantité en stock *</Label>
                    <Input 
                      id="editProdQuantity" 
                      type="number" 
                      min="0" 
                      value={editQuantity} 
                      onChange={(e) => setEditQuantity(Number(e.target.value))} 
                      required
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="editProdMinStock">Seuil minimum d’alerte</Label>
                    <Input 
                      id="editProdMinStock" 
                      type="number" 
                      min="0" 
                      value={editMinimumStock} 
                      onChange={(e) => setEditMinimumStock(Number(e.target.value))} 
                    />
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="editProdDesc">Description</Label>
                    <Input 
                      id="editProdDesc" 
                      value={editDescription} 
                      onChange={(e) => setEditDescription(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditProduct(null);
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isEditing}>
                    {isEditing ? 'Enregistrement...' : 'Enregistrer les modifications'}
                  </Button>
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
    <Suspense fallback={
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100">
        <LoadingDots/>
      </div>
    }>
      <ProductsContent />
    </Suspense>
  );
}