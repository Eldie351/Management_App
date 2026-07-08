"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DashboardCard from "@/components/DashboardCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  const router = useRouter();

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
        fetch("http://localhost:3001/stores", {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("http://localhost:3001/products/user/all", {
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
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
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
      const response = await fetch("http://localhost:3001/stores", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newStoreName,
          location: newStoreLocation,
          currency: newStoreCurrency,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Échec de création");

      setNewStoreName("");
      setNewStoreLocation("");
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
      const res = await fetch(`http://localhost:3001/stores/${storeId}`, {
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
      const response = await fetch("http://localhost:3001/users/staff", {
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
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || "Échec de création du compte.");

      setStaffName("");
      setStaffEmail("");
      setStaffPassword("");
      setStaffRole("MANAGER");
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

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-lg">
        Chargement...
      </div>
    );
  if (error)
    return (
      <div className="flex h-screen items-center justify-center text-red-500">
        {error}
      </div>
    );

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Bonjour {userName || "👋"}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              {getRoleLabel(role as any)} • Vue adaptée à votre parcours
            </p>
          </div>
          <div className="space-x-4">
            <Button variant="outline" onClick={() => router.push("/products")}>
              Gérer les Produits
            </Button>
            {role !== "CASHIER" && (
              <Button onClick={() => setIsModalOpen(true)}>
                + Nouvel Entrepôt
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <DashboardCard
            title="Total Entrepôts"
            value={profile?.stores?.length || 0}
            description="Espaces de stockage enregistrés"
          />
          <DashboardCard
            title="Produits suivis"
            value={profile?.products?.length || 0}
            description="Articles actuellement importés"
          />
          <DashboardCard
            title="Alertes stock"
            value={alertProducts.length}
            description={`${outOfStockCount} rupture(s) • ${lowStockCount} faible(s)`}
          />
        </div>

        {hasAccess(role as any, ["ADMIN"]) && (
          <Card className="mb-6 border-blue-200 bg-blue-50/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Gestion des collaborateurs</CardTitle>
              <Button onClick={() => setIsStaffModalOpen(true)}>
                + Créer un Manager / Caissier
              </Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Cette zone est réservée à l’administrateur pour créer des
                comptes avec les permissions adaptées.
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Vos Espaces de Stockage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {profile?.stores?.map((store: any) => (
                <div
                  key={store.id}
                  onClick={() => router.push(`/products?storeId=${store.id}`)}
                  className="flex flex-col justify-between p-5 border rounded-xl bg-white shadow-sm hover:shadow-md hover:border-blue-500 cursor-pointer transition-all group relative"
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <h3 className="font-semibold text-lg group-hover:text-blue-600 transition-colors pr-6">
                        {store.name}
                      </h3>
                      <button
                        onClick={(e) =>
                          handleDeleteStore(e, store.id, store.name)
                        }
                        className="text-gray-400 hover:text-red-500 absolute top-4 right-4"
                      >
                        🗑️
                      </button>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      📍 {store.location || "Emplacement non spécifié"}
                    </p>
                  </div>
                  <div className="mt-6 pt-4 border-t flex justify-between items-center text-sm">
                    <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 p-1 px-2 rounded">
                      💰 Devise : {store.currency}
                    </span>
                    <span className="font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                      {store._count?.products || 0} produits
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>

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
                  <Button type="submit" disabled={isCreatingStaff}>
                    {isCreatingStaff ? "Création..." : "Créer le compte"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* POPUP DE CRÉATION AVEC CHOIX DE MONNAIE */}
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
                  <Label htmlFor="storeLocation">Adresse / Emplacement</Label>
                  <Input
                    id="storeLocation"
                    placeholder="Ex: Dakar, Sénégal"
                    value={newStoreLocation}
                    onChange={(e) => setNewStoreLocation(e.target.value)}
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
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Création..." : "Confirmer"}
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
