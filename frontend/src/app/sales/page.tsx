'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { LoadingDots } from '@/components/ui/loading_dots';
import { getStoredUserRole, type AppRole } from '@/lib/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Printer, X } from 'lucide-react';

type PaymentMethodType = 'CASH' | 'CARD' | 'MOBILE_MONEY' | 'OTHER';

interface Store {
  id: number;
  name: string;
  location?: string | null;
  currency?: string | null;
  phone?: string | null;
}

interface Product {
  id: number;
  name: string;
  sku?: string | null;
  price: number;
  sellingPrice?: number | null;
  quantity: number;
}

interface CartItem {
  productId: number;
  name: string;
  sku?: string | null;
  unitPrice: number;
  quantity: number;
  availableQuantity: number;
}

interface SaleItem {
  id?: number;
  quantity: number;
  unitPrice: number;
  total: number;
  product?: Product;
}

interface Sale {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  paymentMethod: PaymentMethodType;
  createdAt: string;
  store?: Store;
  user?: {
    name?: string;
  };
  items?: SaleItem[];
  customerName?: string;
  discount?: number;
  amountReceived?: number;
  changeAmount?: number;
}

interface Profile {
  id: number;
  email: string;
  name: string;
  role: string;
  assignedStoreId?: number | null;
  assignedStore?: Store;
  ownedStores?: Store[];
  stores?: Store[];
}

export default function SalesPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // États pour les données
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [latestSale, setLatestSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [storedRole, setStoredRole] = useState<AppRole | null>(null);

  // États pour le panier de vente
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantityToSell, setQuantityToSell] = useState<number>(1);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('Client de passage');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('CASH');
  const [amountReceived, setAmountReceived] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // États pour la barre de recherche de référence interne
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Dédoublonnage et extraction de tous les magasins reçus du profil
  const getUniqueStores = (data: Profile | null): Store[] => {
    if (!data) return [];
    
    const allList: Store[] = [];
    
    if (Array.isArray(data.ownedStores)) allList.push(...data.ownedStores);
    else if (data.ownedStores) allList.push(data.ownedStores);

    if (Array.isArray(data.stores)) allList.push(...data.stores);
    else if (data.stores) allList.push(data.stores);

    if (data.assignedStore) allList.push(data.assignedStore);

    const map = new Map<string, Store>();
    allList.forEach((store) => {
      if (store && store.id !== undefined && store.id !== null) {
        map.set(String(store.id), store);
      }
    });

    return Array.from(map.values());
  };

  const stores = getUniqueStores(profile);

  // 1. Charger le profil pour obtenir les magasins
  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch(`${API}/auth/profil`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Session expirée');

        const data: Profile = await res.json();
        setProfile(data);
        const userRole = getStoredUserRole();
        setStoredRole(userRole);

        // Sélection automatique uniquement s'il n'y a qu'un seul magasin
        // disponible (peu importe le rôle) — sinon on laisse le sélecteur
        // de magasin s'afficher pour que l'utilisateur choisisse parmi
        // TOUS ses magasins assignés.
        const availableStores = getUniqueStores(data);
        if (availableStores.length === 1) {
          setSelectedStoreId(String(availableStores[0].id));
        }
      } catch {
        localStorage.removeItem('access_token');
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router, API]);

  const fetchProductsForStore = useCallback(async (storeId: string) => {
    if (!storeId) {
      setStoreProducts([]);
      return;
    }

    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${API}/products/store/${storeId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setStoreProducts(Array.isArray(data) ? data : []);
      setSelectedProductId('');
      setProductSearchQuery('');
    } catch (err) {
      console.error('Erreur chargement produits:', err);
    }
  }, [API]);

  useEffect(() => {
    if (!selectedStoreId) return;

    const loadStoreData = async () => {
      await fetchProductsForStore(selectedStoreId);
    };

    loadStoreData();
  }, [selectedStoreId, fetchProductsForStore]);

  const handleSelectStore = (storeId: string) => {
    setSelectedStoreId(storeId);
    setLatestSale(null);
    setFormError('');
  };

  // Monnaie du magasin sélectionné
  const currentStoreObj = stores.find((s: Store) => String(s.id) === String(selectedStoreId));
  const storeCurrency = currentStoreObj?.currency || 'XOF';

  // Filtrage des produits dans le champ de recherche
  const filteredProductOptions = storeProducts.filter((p) => {
    const query = productSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      p.name?.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query)
    );
  });

  const currentSelectedProductObj = storeProducts.find(p => String(p.id) === selectedProductId);

  const addToCart = () => {
    setFormError('');
    if (!selectedProductId) {
      setFormError('Veuillez sélectionner un produit dans la liste.');
      return;
    }

    const product = currentSelectedProductObj;
    if (!product) {
      setFormError('Produit introuvable.');
      return;
    }

    if (quantityToSell <= 0) {
      setFormError('La quantité doit être supérieure à 0.');
      return;
    }

    if (quantityToSell > product.quantity) {
      setFormError(`Stock insuffisant. Quantité disponible : ${product.quantity} unités.`);
      return;
    }

    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.productId === product.id);
      if (existing) {
        return currentCart.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: Math.min(item.quantity + quantityToSell, product.quantity) }
            : item,
        );
      }

      return [
        ...currentCart,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: Number(product.sellingPrice ?? product.price ?? 0),
          quantity: quantityToSell,
          availableQuantity: product.quantity,
        },
      ];
    });

    setQuantityToSell(1);
    setSelectedProductId('');
    setProductSearchQuery('');
  };

  const updateCartQuantity = (productId: number, quantity: number) => {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.min(Math.max(quantity, 1), item.availableQuantity) }
          : item,
      ),
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((currentCart) => currentCart.filter((item) => item.productId !== productId));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const cartDiscount = discount > 0 ? Math.min(discount, cartSubtotal) : 0;
  const cartTotal = cartSubtotal - cartDiscount;
  const changeAmount = amountReceived - cartTotal;

  const handleSubmitCart = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedStoreId) {
      setFormError('Veuillez sélectionner un magasin.');
      return;
    }

    if (cart.length === 0) {
      setFormError('Le panier est vide. Ajoutez au moins un produit.');
      return;
    }

    if (amountReceived < cartTotal) {
      setFormError('Le montant reçu est insuffisant.');
      return;
    }

    setIsSubmitting(true);
    const token = localStorage.getItem('access_token');

    try {
      const body = {
        storeId: Number(selectedStoreId),
        paymentMethod,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };

      const response = await fetch(`${API}/sales`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const sale = await response.json();
      if (!response.ok) throw new Error(sale.message || sale.error || 'Échec de la transaction.');

      setLatestSale({
        ...sale,
        customerName,
        paymentMethod,
        amountReceived,
        discount: cartDiscount,
        changeAmount,
      });
      setCart([]);
      await fetchProductsForStore(selectedStoreId);
      setAmountReceived(0);
      setDiscount(0);
      setCustomerName('Client de passage');
      setPaymentMethod('CASH');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const printLatestSale = (sale: Sale | null) => {
    if (!sale) return;
    const items = sale.items ?? [];
    const storeName = sale.store?.name ?? currentStoreObj?.name ?? 'Magasin';
    const storeLocation = sale.store?.location ?? currentStoreObj?.location ?? '';
    const storePhone = sale.store?.phone ?? 'N/A';
    const formattedLocation = storeLocation.includes('Bénin')
      ? storeLocation
      : `${storeLocation}${storeLocation ? ', Bénin' : 'Bénin'}`;
    const currency = sale.store?.currency ?? currentStoreObj?.currency ?? 'XOF';
    const html = `
      <html>
        <head>
          <title>Reçu ${sale.invoiceNumber}</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; padding: 20px; color: #111; }
            h1, h2, h3 { margin: 0; }
            .invoice-header { text-align: center; margin-bottom: 12px; line-height: 1.4; }
            .invoice-header p { margin: 2px 0; }
            .divider { margin: 16px 0; border-top: 2px solid #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 8px 6px; border-bottom: 1px solid #ddd; text-align: left; }
            .summary { margin-top: 18px; }
            .summary div { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .total { font-weight: bold; font-size: 1rem; margin-top: 8px; }
          </style>
        </head>
        <body>
          <div class="invoice-header">
            <h1>${storeName}</h1>
            <p>${formattedLocation}</p>
            <p>Tél : ${storePhone}</p>
          </div>
          <div class="divider"></div>
          <p><strong>FACTURE N° :</strong> ${sale.invoiceNumber}</p>
          <p><strong>Date :</strong> ${new Date(sale.createdAt).toLocaleDateString('fr-FR')} à ${new Date(sale.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
          <p><strong>Vendeur :</strong> ${sale.user?.name ?? ''}</p>
          <p><strong>Client :</strong> ${sale.customerName ?? 'Client de passage'}</p>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th>SKU</th>
                <th>Qté</th>
                <th>PU</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${items
                .map((it: SaleItem) => `
                    <tr>
                      <td>${it.product?.name ?? ''}</td>
                      <td>${it.product?.sku ?? ''}</td>
                      <td>${it.quantity}</td>
                      <td>${Number(it.unitPrice).toFixed(2)}</td>
                      <td>${Number(it.total).toFixed(2)}</td>
                    </tr>
                  `)
                .join('')}
            </tbody>
          </table>
          <div class="summary">
            <div><span>Sous-total</span><span>${Number(sale.totalAmount ?? 0).toFixed(2)} ${currency}</span></div>
            <div><span>Remise</span><span>${Number(sale.discount ?? 0).toFixed(2)} ${currency}</span></div>
            <div><span>Montant reçu</span><span>${Number(sale.amountReceived ?? 0).toFixed(2)} ${currency}</span></div>
            <div class="total"><span>Total payé</span><span>${Number(sale.totalAmount).toFixed(2)} ${currency}</span></div>
            <div><span>Rendu</span><span>${Number(sale.changeAmount ?? 0).toFixed(2)} ${currency}</span></div>
            <div><span>Mode</span><span>${sale.paymentMethod ?? ''}</span></div>
          </div>
        </body>
      </html>
    `;
    const w = window.open('', '_blank', 'width=600,height=800');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); w.close(); }, 300);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-100">
        <LoadingDots size="h-4 w-4" color="bg-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        {!selectedStoreId ? (
          <div className="space-y-6">
            <div className="border-b pb-4 mb-6">
              <h1 className="text-3xl font-bold tracking-tight">Choisissez votre magasin</h1>
              <p className="text-muted-foreground mt-1">Sélectionnez d&apos;abord un magasin pour commencer à enregistrer des ventes.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {stores.length > 0 ? (
                stores.map((store: Store) => (
                  <Card key={store.id} className="cursor-pointer hover:border-blue-500 hover:shadow-lg transition-shadow bg-white" onClick={() => handleSelectStore(String(store.id))}>
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
                  <CardContent className="pt-6">
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
                <Button variant="outline" size="sm" onClick={() => router.push(`/receipts?storeId=${selectedStoreId}`)}>
                  Flux de transactions
                </Button>
                {storedRole !== 'CASHIER' && (
                  <Button variant="outline" size="sm" onClick={() => setSelectedStoreId('')}>
                    Changer de magasin
                  </Button>
                )}
              </div>
            </div>

            {latestSale && (
              <Card className="mb-6 border-green-200 bg-green-50/50">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-green-800 text-lg">Facture {latestSale.invoiceNumber} enregistrée</CardTitle>
                    <CardDescription className="text-green-600">
                      Montant total : <strong>{Number(latestSale.totalAmount).toFixed(2)} {storeCurrency}</strong> | Client : {latestSale.customerName || 'Client de passage'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="bg-green-700 hover:bg-green-800 text-white" onClick={() => printLatestSale(latestSale)}>
                      <Printer className="size-4 mr-1.5" /> Imprimer le reçu
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setLatestSale(null)}>
                      <X className="size-4 text-gray-500" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            )}

            <div className="grid gap-6 md:grid-cols-3 mb-6">
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Catalogue & Panier</CardTitle>
                  <CardDescription>Ajoutez des produits au panier puis validez la facture.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
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
                        <div className="absolute left-0 right-0 z-30 max-h-80 overflow-y-auto overscroll-contain scroll-smooth border border-gray-200 bg-white rounded-lg shadow-xl mt-1 divide-y divide-gray-50">
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
                      <Label htmlFor="saleQty">Quantité</Label>
                      <Input
                        id="saleQty"
                        type="number"
                        min="1"
                        value={quantityToSell}
                        onChange={(e) => setQuantityToSell(Number(e.target.value))}
                        required
                      />
                    </div>

                    <Button type="button" onClick={addToCart} className="w-full bg-blue-600 hover:bg-blue-700 font-medium h-10" disabled={!selectedProductId}>
                      Ajouter au panier
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Panier de commande</CardTitle>
                  <CardDescription>Révisez les articles, appliquez une remise et générez la facture.</CardDescription>
                </CardHeader>
                <CardContent>
                  {cart.length === 0 ? (
                    <div className="text-sm text-gray-500 py-6 text-center">Aucun produit dans le panier pour le moment.</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="py-2">Désignation</th>
                              <th className="py-2 text-center">Qté</th>
                              <th className="py-2 text-right">P.U</th>
                              <th className="py-2 text-right">Total</th>
                              <th className="py-2 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cart.map((item) => (
                              <tr key={item.productId} className="border-b">
                                <td className="py-2">
                                  <div className="font-medium">{item.name}</div>
                                  <div className="text-xs text-gray-400">SKU: {item.sku || 'N/A'}</div>
                                </td>
                                <td className="py-2 text-center">
                                  <Input
                                    type="number"
                                    min="1"
                                    max={item.availableQuantity}
                                    value={item.quantity}
                                    onChange={(e) => updateCartQuantity(item.productId, Number(e.target.value))}
                                    className="w-20 text-sm mx-auto"
                                  />
                                </td>
                                <td className="py-2 text-right">{Number(item.unitPrice).toFixed(2)}</td>
                                <td className="py-2 text-right">{Number(item.unitPrice * item.quantity).toFixed(2)}</td>
                                <td className="py-2 text-right">
                                  <Button size="sm" variant="outline" type="button" onClick={() => removeFromCart(item.productId)}>
                                    Retirer
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="customerName">Client</Label>
                            <Input
                              id="customerName"
                              type="text"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                            />
                          </div>
                          <div>
                            <Label htmlFor="paymentMethod">Règlement</Label>
                            <select
                              id="paymentMethod"
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodType)}
                              className="w-full rounded-lg border p-2 text-sm bg-white"
                            >
                              <option value="CASH">Espèces</option>
                              <option value="MOBILE_MONEY">MoMo</option>
                              <option value="CARD">Carte</option>
                              <option value="OTHER">Autre</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="discount">Remise ({storeCurrency})</Label>
                            <Input
                              id="discount"
                              type="number"
                              min="0"
                              value={discount}
                              onChange={(e) => setDiscount(Number(e.target.value))}
                            />
                          </div>
                          <div>
                            <Label htmlFor="amountReceived">Montant reçu ({storeCurrency})</Label>
                            <Input
                              id="amountReceived"
                              type="number"
                              min="0"
                              value={amountReceived}
                              onChange={(e) => setAmountReceived(Number(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border bg-gray-50 p-4 text-sm">
                        <div className="flex justify-between py-1">
                          <span>Sous-total</span>
                          <strong>{cartSubtotal.toFixed(2)} {storeCurrency}</strong>
                        </div>
                        <div className="flex justify-between py-1">
                          <span>Remise</span>
                          <strong>- {cartDiscount.toFixed(2)} {storeCurrency}</strong>
                        </div>
                        <div className="border-t pt-2 flex justify-between font-semibold">
                          <span>TOTAL À PAYER</span>
                          <strong>{cartTotal.toFixed(2)} {storeCurrency}</strong>
                        </div>
                        <div className="border-t pt-2 flex justify-between text-sm text-gray-600">
                          <span>Rendu</span>
                          <strong>{changeAmount >= 0 ? changeAmount.toFixed(2) : '0.00'} {storeCurrency}</strong>
                        </div>
                      </div>

                      <Button
                        type="button"
                        className="w-full bg-green-600 hover:bg-green-700 font-medium h-10"
                        onClick={handleSubmitCart}
                        disabled={isSubmitting || cart.length === 0 || amountReceived < cartTotal}
                      >
                        {isSubmitting ? 'Génération en cours...' : 'Générer la facture'}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}