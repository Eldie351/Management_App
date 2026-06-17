'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Identifiants invalides');
      }

      // Sauvegarde automatique du jeton de session
      localStorage.setItem('access_token', data.access_token);
      
      // Redirection immédiate vers le dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-4 relative">
      
      {/* 1. BOUTON DE RETOUR FLOTTANT (EN HAUT À GAUCHE) */}
      <Link 
        href="/" 
        className="absolute top-6 left-6 flex items-center space-x-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span>←</span>
        <span>Retour à l'accueil</span>
      </Link>

      <Card className="w-full max-w-[400px] shadow-md bg-white">
        <CardHeader className="space-y-1 text-center">
          {/* 2. LE LOGO EST CLIQUABLE */}
          <Link href="/" className="inline-block mb-2 text-2xl font-bold text-gray-900 tracking-tight hover:opacity-80 transition-opacity">
            Octo<span className="text-blue-600">Stock</span>
          </Link>
          <CardTitle className="text-2xl font-bold tracking-tight">Connexion</CardTitle>
          <CardDescription>
            Connectez-vous pour accéder à vos tableaux de bord.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <p className="text-sm text-red-500 bg-red-50 p-2.5 rounded-lg text-center font-medium">
                {error}
              </p>
            )}
            
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="nom@exemple.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                disabled={isSubmitting}
                required 
              />
            </div>
            
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                disabled={isSubmitting}
                required 
              />
            </div>
            
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-medium h-10 mt-2" disabled={isSubmitting}>
              {isSubmitting ? 'Connexion en cours...' : 'Se connecter'}
            </Button>

            <div className="text-center text-sm text-gray-500 pt-2 border-t mt-4">
              Pas encore de compte ?{' '}
              <Link href="/register" className="text-blue-600 hover:underline font-medium">
                S'inscrire
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
