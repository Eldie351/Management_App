'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LayoutDashboard, Package, ShoppingCart, BarChart3 } from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col justify-between">
      {/* 1. EN-TÊTE (BARRE DE NAVIGATION) */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border-b border-gray-200/60 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-gray-900 tracking-tight">
            Octo<span className="text-blue-600">Stock</span>
          </span>
        </div>
        <div className="space-x-4">
          <Button variant="ghost" onClick={() => router.push('/login')} className="font-medium">
            Connexion
          </Button>
          <Button onClick={() => router.push('/register')} className="bg-blue-600 hover:bg-blue-700 font-medium">
            Créer un compte
          </Button>
        </div>
      </header>

      {/* 2. ZONE PRINCIPALE (HERO SECTION) */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-5xl mx-auto px-6 text-center py-16 md:py-24 space-y-8">
        <div className="space-y-4">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 tracking-wide uppercase">
            Gestion de Stock Intelligente
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight max-w-4xl mx-auto">
            Prenez le contrôle total de vos entrepôts et marchandises
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto font-normal">
            Optimisez votre logistique en temps réel. Suivez vos stocks, enregistrez vos ventes et analysez vos performances financières depuis une interface unique.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 w-full sm:w-auto">
          <Button 
            size="lg" 
            onClick={() => router.push('/login')} 
            className="w-full sm:w-52 h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-100 transition-all"
          >
            Démarrer gratuitement
          </Button>
          <Button 
            size="lg" 
            variant="outline"
            onClick={() => router.push('/login')} 
            className="w-full sm:w-52 h-12 text-base font-medium border-gray-200 bg-white shadow-sm"
          >
            Découvrir l'interface
          </Button>
        </div>

        {/* GRILLE DES FONCTIONNALITÉS CLÉS */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 w-full pt-12">
          <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                <LayoutDashboard size={24} />
              </div>
              <h3 className="font-bold text-gray-800">Multi-Entrepôts</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Gérez plusieurs espaces de stockage et points de vente physiques en simultané.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <Package size={24} />
              </div>
              <h3 className="font-bold text-gray-800">Suivi Dynamique</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Formule automatisée calculant vos stocks de départ par rapport à vos réapprovisionnements.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <ShoppingCart size={24} />
              </div>
              <h3 className="font-bold text-gray-800">Registre des Ventes</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Déduisez du stock et historisez durablement vos flux de commandes dans PostgreSQL.</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
            <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                <BarChart3 size={24} />
              </div>
              <h3 className="font-bold text-gray-800">Analyses Réelles</h3>
              <p className="text-xs text-gray-400 leading-relaxed">Visualisez graphiquement votre Chiffre d'Affaires cumulé par jour, mois et année.</p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 3. PIED DE PAGE */}
      <footer className="w-full border-t border-gray-200/60 py-6 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-400 gap-4">
          <p>© 2026 OctoStock. Tous droits réservés.</p>
          <div className="flex space-x-6">
            <span className="hover:text-gray-600 cursor-pointer">Conditions</span>
            <span className="hover:text-gray-600 cursor-pointer">Confidentialité</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
