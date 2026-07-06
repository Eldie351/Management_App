'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:3001/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Impossible d’envoyer la demande.');
      }

      const successMessage = data.message || 'Si un compte existe, vous recevrez un email de réinitialisation.';
      setMessage(data.resetUrl ? `${successMessage}\n\nLien de test: ${data.resetUrl}` : successMessage);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-[420px] shadow-md bg-white">
        <CardHeader className="text-center">
          <Link href="/login" className="text-sm text-blue-600 hover:underline">← Retour à la connexion</Link>
          <CardTitle className="mt-3 text-2xl font-bold">Mot de passe oublié</CardTitle>
          <CardDescription>Entrez votre adresse email pour recevoir un lien de réinitialisation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-500 text-center">{error}</p>}
            {message && <p className="rounded-lg bg-green-50 p-2.5 text-sm text-green-600 text-center">{message}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isSubmitting} />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Envoi en cours...' : 'Envoyer le lien'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
