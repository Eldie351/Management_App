"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardCard from "@/components/DashboardCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingDots } from "@/components/ui/loading_dots";
import {
  Warehouse,
  Package,
  AlertTriangle,
  PackageX,
  Plus,
  ArrowRight,
  Trash2,
} from "lucide-react";
import { getStockStatus } from "@/lib/stock-status";
import {
  getStoredUserRole,
  getStoredUserName,
  getRoleLabel,
  hasAccess,
} from "@/lib/auth";

export default function DashboardPage() {
  const [profile, setProfile] = useState<any>({ stores: [], products: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreLocation, setNewStoreLocation] = useState("");
  const [newStorePhone, setNewStorePhone] = useState("");
  const [newStoreCurrency, setNewStoreCurrency] = useState("XOF");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [staffFormError, setStaffFormError] = useState("");
  const [staffFormSuccess, setStaffFormSuccess] = useState("");
  const [isCreatingStaff, setIsCreatingStaff] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffRole, setStaffRole] = useState<"MANAGER" | "CASHIER">("MANAGER");
  const [staffStoreIds, setStaffStoreIds] = useState<number[]>([]);

  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  const fetchProfileData = async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }

    setRole(getStoredUserRole());
    setUserName(getStoredUserName());

    try {
      const [storesRes, productsRes] = await Promise.all([
        fetch(`${API}/stores`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API}/products/user/all`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }),
      ]);

      if (!storesRes.ok) throw new Error("Session expirée.");
      if (!productsRes.ok)
        throw new Error("Impossible de charger les alertes produits.");

      const [storesData, productsData] = await Promise.all([
        storesRes.json(),
        productsRes.json(),
      ]);
      setProfile({ stores: storesData, products: productsData });
      setStaffStoreIds(storesData?.[0] ? [storesData[0].id] : []);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue lors du chargement des données.");
      localStorage.removeItem("access_token");
      setTimeout(() => router.push("/login"), 2000);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [router]);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);
    const token = localStorage.getItem("access_token");

    try {
      const response = await fetch(`${API}/stores`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newStoreName,
          location: newStoreLocation,
          phone: newStorePhone,
          currency: newStoreCurrency,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Échec de création");

      setNewStoreName("");
      setNewStoreLocation("");
      setNewStorePhone("");
      setNewStoreCurrency("XOF");
      setIsModalOpen(false);
      fetchProfileData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStore = async (
    e: React.MouseEvent,
    storeId: number,
    storeName: string,
  ) => {
    e.stopPropagation();
    if (!confirm(`Supprimer l'entrepôt "${storeName}" et ses produits ?`))
      return;
    const token = localStorage.getItem("access_token");
    try {
      const res = await fetch(`${API}/stores/${storeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Échec suppression.");
      fetchProfileData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFormError("");
    setStaffFormSuccess("");
    setIsCreatingStaff(true);
    const token = localStorage.getItem("access_token");

    try {
      if (staffStoreIds.length === 0) {
        throw new Error("Veuillez assigner au moins un magasin à ce collaborateur.");
      }

      const response = await fetch(`${API}/users/staff`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: staffName,
          email: staffEmail,
          password: staffPassword,
          role: staffRole,
          storeIds: staffStoreIds,
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Échec de création du compte.");

      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
      setStaffRole("MANAGER");
      setStaffStoreIds(profile.stores?.[0] ? [profile.stores[0].id] : []);
      setIsStaffModalOpen(false);
      setStaffFormSuccess(
        `Compte ${data.role.toLowerCase()} créé avec succès pour ${data.name}.`,
      );
    } catch (err: any) {
      setStaffFormError(err.message);
    } finally {
      setIsCreatingStaff(false);
    }
  };

  const alertProducts = (profile?.products || []).filter(
    (product: any) => getStockStatus(product) !== "IN_STOCK",
  );
  const outOfStockCount = alertProducts.filter(
    (product: any) => getStockStatus(product) === "OUT_OF_STOCK",
  ).length;
  const lowStockCount = alertProducts.filter(
    (product: any) => getStockStatus(product) === "LOW_STOCK",
  ).length;

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <LoadingDots size="h-4 w-4" color="bg-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 font-semibold text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Bonjour {userName}
            </h1>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                <span className="size-1.5 rounded-full bg-indigo-500" />
                {getRoleLabel(role as any)}
              </span>
              <span className="text-sm text-slate-500">Tableau de bord</span>
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push("/products")}>
            Gérer les Produits
            <ArrowRight className="size-4" />
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <DashboardCard
            title="Entrepôts"
            value={profile?.stores?.length || 0}
            description="Espaces de stockage enregistrés"
            icon={Warehouse}
            accent="indigo"
          />
          <DashboardCard
            title="Produits suivis"
            value={profile?.products?.length || 0}
            description="Articles actuellement importés"
            icon={Package}
            accent="violet"
          />
          <DashboardCard
            title="Stock faible"
            value={lowStockCount}
            description="Produits sous le seuil d'alerte"
            icon={AlertTriangle}
            accent="amber"
          />
          <DashboardCard
            title="Ruptures"
            value={outOfStockCount}
            description="Produits en rupture de stock"
            icon={PackageX}
            accent="rose"
          />
        </div>

        {hasAccess(role as any, ["ADMIN"]) && (
          <Card className="mb-6 border-indigo-100 bg-indigo-50/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Gestion des collaborateurs</CardTitle>
                <p className="mt-1 text-sm text-slate-600">
                  Réservé à l'administrateur pour créer des comptes avec les
                  permissions adaptées.
                </p>
              </div>
              <Button onClick={() => setIsStaffModalOpen(true)}>
                <Plus className="size-4" />
                Créer un Manager / Caissier
              </Button>
            </CardHeader>
          </Card>
        )}

        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Vos espaces de stockage
            </h2>
            <p className="text-xs text-slate-400">
              {profile?.stores?.length || 0} entrepôt{(profile?.stores?.length || 0) > 1 ? "s" : ""} actif{(profile?.stores?.length || 0) > 1 ? "s" : ""}
            </p>
          </div>
          {role === "ADMIN" && (
            <Button size="sm" onClick={() => setIsModalOpen(true)}>
              <Plus className="size-4" />
              Nouvel entrepôt
            </Button>
          )}
        </div>

        {profile?.stores?.length ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profile.stores.map((store: any) => {
              const storeProductsCount =
                profile.products?.filter(
                  (p: any) => p.storeId === store.id || p.store?.id === store.id
                ).length ?? store._count?.products ?? store.products?.length ?? 0;

              return (
                <div
                  key={store.id}
                  onClick={() => router.push(`/products?storeId=${store.id}`)}
                  className="group relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                          <Warehouse className="size-4" />
                        </span>
                        <h3 className="truncate font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {store.name}
                        </h3>
                      </div>
                      {role === "ADMIN" && (
                        <button
                          onClick={(e) => handleDeleteStore(e, store.id, store.name)}
                          title="Supprimer l'entrepôt"
                          className="shrink-0 rounded-md bg-red-50 p-1.5 text-red-500 transition-colors hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                    <p className="mt-2 pl-11.5 text-sm text-slate-500">
                      {store.location || "Emplacement non spécifié"}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
                    <span className="rounded bg-slate-100 px-2 py-1 font-mono text-xs font-bold text-slate-500">
                      {store.currency}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 font-semibold text-indigo-600">
                      {storeProductsCount} produit{storeProductsCount > 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
              <Warehouse className="size-6" />
            </span>
            <p className="mt-3 font-medium text-slate-700">Aucun entrepôt pour le moment</p>
            <p className="mt-1 text-sm text-slate-400">
              Créez votre premier espace de stockage pour commencer à suivre vos produits.
            </p>
          </div>
        )}
      </main>

      {/* MODAL CRÉATION COLLABORATEUR */}
      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <Card className="w-[480px] shadow-2xl bg-white animate-in fade-in duration-200">
            <CardHeader>
              <CardTitle>Créer un compte Manager / Caissier</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStaff} className="space-y-4">
                {staffFormError && (
                  <p className="text-sm text-red-500 bg-red-50 p-2 rounded text-center">
                    {staffFormError}
                  </p>
                )}
                {staffFormSuccess && (
                  <p className="text-sm text-green-600 bg-green-50 p-2 rounded text-center">
                    {staffFormSuccess}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="staffName">Nom complet *</Label>
                  <Input
                    id="staffName"
                    placeholder="Ex: Awa Diop"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staffEmail">Email *</Label>
                  <Input
                    id="staffEmail"
                    type="email"
                    placeholder="manager@entreprise.com"
                    value={staffEmail}
                    onChange={(e) => setStaffEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staffPassword">Mot de passe *</Label>
                  <Input
                    id="staffPassword"
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Magasins assignés *</Label>
                  <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
                    {profile.stores?.length ? (
                      profile.stores.map((store: any) => (
                        <label key={store.id} className="flex items-center gap-3 text-sm text-gray-700 py-1">
                          <input
                            type="checkbox"
                            checked={staffStoreIds.includes(store.id)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setStaffStoreIds((current) =>
                                checked
                                  ? [...current, store.id]
                                  : current.filter((id) => id !== store.id),
                              );
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span>
                            {store.name}
                            {store.location ? ` — ${store.location}` : ""}
                          </span>
                        </label>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400">Aucun magasin disponible.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="staffRole">Rôle *</Label>
                  <select
                    id="staffRole"
                    value={staffRole}
                    onChange={(e) =>
                      setStaffRole(e.target.value as "MANAGER" | "CASHIER")
                    }
                    className="w-full p-2 border rounded-lg bg-white shadow-sm font-semibold outline-none text-sm text-gray-700 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="CASHIER">Caissier</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsStaffModalOpen(false);
                      setStaffFormError("");
                      setStaffFormSuccess("");
                    }}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isCreatingStaff} className="min-w-[130px] flex justify-center">
                    {isCreatingStaff ? (
                      <LoadingDots size="h-2 w-2" color="bg-white" />
                    ) : (
                      "Créer le compte"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* POPUP DE CRÉATION DE MAGASIN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <Card className="w-[450px] shadow-2xl bg-white animate-in fade-in duration-200">
            <CardHeader>
              <CardTitle>Créer un nouvel espace de stockage</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateStore} className="space-y-4">
                {formError && (
                  <p className="text-sm text-red-500 bg-red-50 p-2 rounded text-center">
                    {formError}
                  </p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="storeName">Nom de l'entrepôt *</Label>
                  <Input
                    id="storeName"
                    placeholder="Ex: Entrepôt Paris"
                    value={newStoreName}
                    onChange={(e) => setNewStoreName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storeLocation">Adresse / Emplacement *</Label>
                  <Input
                    id="storeLocation"
                    placeholder="Ex: Quartier X / Adresse - Ville, Bénin"
                    value={newStoreLocation}
                    onChange={(e) => setNewStoreLocation(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storePhone">Téléphone du magasin *</Label>
                  <Input
                    id="storePhone"
                    placeholder="Ex: (+229) 01 12 34 56 78"
                    value={newStorePhone}
                    onChange={(e) => setNewStorePhone(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="storeCurrency">Devise d'exploitation *</Label>
                  <select
                    id="storeCurrency"
                    value={newStoreCurrency}
                    onChange={(e) => setNewStoreCurrency(e.target.value)}
                    className="w-full p-2 border rounded-lg bg-white shadow-sm font-semibold outline-none text-sm text-gray-700 focus:border-blue-500 cursor-pointer"
                  >
                    <option value="XOF">Franc CFA (XOF)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="USD">Dollar (USD)</option>
                    <option value="GBP">Livre Sterling (GBP)</option>
                    <option value="NGN">Naira (NGN)</option>
                    <option value="GHS">Cedi du Ghana (GHS)</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t mt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="min-w-[100px] flex justify-center">
                    {isSubmitting ? (
                      <LoadingDots size="h-2 w-2" color="bg-white" />
                    ) : (
                      "Confirmer"
                    )}
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