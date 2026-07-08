'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { persistUserSession } from '@/lib/auth';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);

    try {
      const registerResponse = await fetch('http://localhost:3001/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const registerData = await registerResponse.json().catch(() => ({}));

      if (!registerResponse.ok) {
        throw new Error(registerData.message || 'Impossible de créer le compte.');
      }

      const loginResponse = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginResponse.json().catch(() => ({}));

      if (!loginResponse.ok) {
        throw new Error(loginData.message || 'Compte créé, mais la connexion a échoué.');
      }

      persistUserSession({ access_token: loginData.access_token, role: loginData.role, name: loginData.name });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-50 px-4 relative">
      <Link
        href="/"
        className="absolute top-6 left-6 flex items-center space-x-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
      >
        <span>←</span>
        <span>Retour à l'accueil</span>
      </Link>

      <Card className="w-full max-w-[430px] shadow-md bg-white">
        <CardHeader className="space-y-1 text-center">
          <Link href="/" className="inline-block mb-2 text-2xl font-bold text-gray-900 tracking-tight hover:opacity-80 transition-opacity">
            Octo<span className="text-blue-600">Stock</span>
          </Link>
          <CardTitle className="text-2xl font-bold tracking-tight">Créer un compte</CardTitle>
          <CardDescription>
            Commencez à gérer vos magasins et produits en quelques secondes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <p className="text-sm text-red-500 bg-red-50 p-2.5 rounded-lg text-center font-medium">
                {error}
              </p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="name">Nom complet</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jean Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

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

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 font-medium h-10 mt-2" disabled={isSubmitting}>
              {isSubmitting ? 'Création du compte...' : 'Créer mon compte'}
            </Button>

            <div className="text-center text-sm text-gray-500 pt-2 border-t mt-4">
              Déjà un compte ?{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">
                Se connecter
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
