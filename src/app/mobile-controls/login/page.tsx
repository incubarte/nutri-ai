
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

const AUTH_KEY = 'icevision-remote-auth-key';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          localStorage.setItem(AUTH_KEY, password);
          toast({ title: '¡Acceso Concedido!', description: 'Serás redirigido a los controles.' });
          router.replace('/mobile-controls');
        } else {
          toast({ title: 'Contraseña Incorrecta', description: 'Por favor, verifica la contraseña e intenta de nuevo.', variant: 'destructive' });
          setPassword('');
        }
      } else {
        toast({ title: 'Error de Autenticación', description: 'No se pudo verificar la contraseña. Intenta más tarde.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error de Red', description: 'No se pudo conectar con el servidor.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col justify-center h-full">
      <div className="text-center mb-8">
        <KeyRound className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-3xl font-bold text-primary-foreground mt-4">Acceso Remoto</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ingresar Contraseña</CardTitle>
          <CardDescription>
            Pide la contraseña de 5 dígitos al operador principal para acceder a los controles.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña de 5 dígitos</Label>
              <Input
                id="password"
                type="password"
                inputMode="numeric"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="*****"
                maxLength={5}
                className="h-14 text-2xl text-center tracking-[0.5em]"
                required
              />
            </div>
            <Button type="submit" className="w-full h-14 text-lg" disabled={isLoading}>
              {isLoading ? <LoadingSpinner className="mr-2" /> : <LogIn className="mr-2 h-5 w-5" />}
              Ingresar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
