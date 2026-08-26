'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getStoredUserRole } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingDots } from '@/components/ui/loading_dots';

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
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue lors du chargement du profil.');
    } finally {
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
      alert(err.message || 'Erreur lors de la suppression.');
      setIsDeleting(false);
    }
  };

  // Action : Déconnexion manuelle
  const handleLogout = () => {
    localStorage.removeItem('access_token');
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <LoadingDots size="h-4 w-4" color="bg-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center font-semibold text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Mon Compte Utilisateur</h1>
            <p className="mt-1 text-muted-foreground">Gérez vos options de profil et vos configurations globales.</p>
          </div>
          <Button variant="outline" onClick={handleLogout} className="border-red-200 text-red-500 hover:bg-red-50">
            Déconnexion
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* FICHE DES INFORMATIONS PERSONNELLES */}
          <Card className={role === 'ADMIN' ? 'md:col-span-2' : 'md:col-span-3'}>
            <CardHeader>
              <CardTitle>Détails du Profil</CardTitle>
              <CardDescription>Vos informations de compte enregistrées localement.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <span className="text-xs font-semibold uppercase text-gray-400">Nom complet</span>
                  <p className="mt-0.5 text-lg font-medium text-gray-800">{profile?.name}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-gray-400">Identifiant système</span>
                  <p className="mt-0.5 font-mono text-lg text-gray-600">#{profile?.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <span className="text-xs font-semibold uppercase text-gray-400">Adresse e-mail</span>
                  <p className="mt-0.5 text-lg font-medium text-gray-800">{profile?.email}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase text-gray-400">Rôle de sécurité</span>
                  <p className="mt-0.5 text-lg font-medium text-blue-600">
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-sm font-semibold">{profile?.role}</span>
                  </p>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold uppercase text-gray-400">Date de création du compte</span>
                <p className="mt-0.5 text-sm text-gray-600">
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

          {/* ZONE DANGER (RÉSERVÉE STRICTEMENT AUX ADMINS) */}
          {role === 'ADMIN' && (
            <div className="space-y-6">
              <Card className="border-red-200 bg-red-50/30">
                <CardHeader>
                  <CardTitle className="text-base text-red-600">Zone de danger</CardTitle>
                  <CardDescription className="text-xs text-red-500">
                    Ces actions suppriment définitivement vos données.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="destructive" 
                    className="flex h-10 w-full items-center justify-center bg-red-600 hover:bg-red-700"
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <LoadingDots size="h-2 w-2" color="bg-white" />
                    ) : (
                      'Supprimer mon compte'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}