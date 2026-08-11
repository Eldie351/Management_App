'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
// Remplacez votre ligne 5 par celle-ci (sans les accolades) :
import Sidebar from '@/components/Sidebar';
import { getStoredUserRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfilPage() {
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  // Charger les données du profil utilisateur
  const fetchProfile = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const res = await fetch(`${API}/auth/profil`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error('Impossible de charger le profil.');
      const data = await res.json();
      setProfile(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    setRole(getStoredUserRole());
    fetchProfile();
  }, [router]);

  // Action : Supprimer définitivement le compte
  const handleDeleteAccount = async () => {
    const confirmation = confirm(
      "⚠️ ATTENTION : Voulez-vous vraiment supprimer définitivement votre compte ? Cette action effacera TOUS vos entrepôts et TOUS vos produits associés sans retour en arrière possible."
    );

    if (!confirmation) return;

    setIsDeleting(true);
    const token = localStorage.getItem('access_token');

    try {
      const res = await fetch(`${API}/auth/compte`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Échec de la suppression du compte.');
      }

      alert(data.message || 'Compte supprimé avec succès.');
      
      // Nettoyage local et déconnexion forcée
      localStorage.removeItem('access_token');
      router.push('/login');
    } catch (err: any) {
      alert(err.message);
      setIsDeleting(false);
    }
  };

  // Action : Déconnexion manuelle
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/login');
  };

  if (loading) return <div className="flex h-screen items-center justify-center text-lg">Chargement de votre compte utilisateur...</div>;
  if (error) return <div className="flex h-screen items-center justify-center text-red-500 font-semibold">{error}</div>;

  // Calcul du nombre total de produits à travers tous les magasins pour la statistique
  const totalProducts = profile?.stores?.reduce((acc: number, store: any) => acc + (store._count?.products || 0), 0) || 0;

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mon Compte Utilisateur</h1>
            <p className="text-muted-foreground mt-1">Gérez vos options de profil et vos configurations globales.</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="text-red-500 border-red-200 hover:bg-red-50">
            Déconnexion
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* FICHE DES INFORMATIONS PERSONNELLES */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Détails du Profil</CardTitle>
              <CardDescription>Vos informations de compte enregistrées localement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold">Nom complet</span>
                  <p className="text-lg font-medium text-gray-800 mt-0.5">{profile?.name}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold">Identifiant système</span>
                  <p className="text-lg font-mono text-gray-600 mt-0.5">#{profile?.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold">Adresse e-mail</span>
                  <p className="text-lg font-medium text-gray-800 mt-0.5">{profile?.email}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-400 uppercase font-semibold">Rôle de sécurité</span>
                  <p className="text-lg font-medium text-blue-600 mt-0.5">
                    <span className="bg-blue-50 px-2 py-0.5 rounded text-sm font-semibold">{profile?.role}</span>
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs text-gray-400 uppercase font-semibold">Date de création du compte</span>
                <p className="text-sm text-gray-600 mt-0.5">
                  {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* RÉSUMÉ LOGISTIQUE DU COMPTE */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Résumé d'activité</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">Nombre d'entrepôts</span>
                  <span className="font-bold text-gray-800">{profile?.stores?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-500">Références en stock</span>
                  <span className="font-bold text-gray-800">{totalProducts}</span>
                </div>
              </CardContent>
            </Card>

            {/* ZONE DANGER (SUPPRESSION DE COMPTE) */}
            {role !== 'CASHIER' && (
              <Card className="border-red-200 bg-red-50/30">
              <CardHeader>
                <CardTitle className="text-red-600 text-base">Zone de danger</CardTitle>
                <CardDescription className="text-red-500 text-xs">Ces actions suppriment définitivement vos données.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="destructive" 
                  className="w-full bg-red-600 hover:bg-red-700"
                  onClick={handleDeleteAccount}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Suppression en cours...' : 'Supprimer mon compte'}
                </Button>
              </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
