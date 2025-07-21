
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Send, RefreshCw, CheckCircle, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import type { AccessRequest, Challenge } from '@/types';
import { cn } from '@/lib/utils';

const AUTH_KEY = 'icevision-remote-auth-key';

type AuthScreenState = 'idle' | 'requesting' | 'waiting' | 'challenge' | 'error';

export default function LoginPage() {
  const [screenState, setScreenState] = useState<AuthScreenState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [requestInfo, setRequestInfo] = useState<AccessRequest | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const { toast } = useToast();

  const handleRequestAccess = async () => {
    setScreenState('requesting');
    setError(null);
    try {
      const userAgent = navigator.userAgent;
      const res = await fetch('/api/auth-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', userAgent }),
      });
      const data = await res.json();
      if (data.success && data.request) {
        setRequestInfo(data.request);
        setScreenState('waiting');
      } else {
        throw new Error(data.message || "Failed to submit access request.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not connect to server.');
      setScreenState('error');
    }
  };
  
  const checkRequestStatus = useCallback(async () => {
    if (!requestInfo?.id || screenState !== 'waiting') return;

    try {
        const res = await fetch('/api/auth-challenge');
        if (!res.ok) return; // Don't show error for polling
        const data = await res.json();
        const myRequest = (data.requests as AccessRequest[]).find(r => r.id === requestInfo.id);

        if (!myRequest) {
            // Request was likely rejected or expired
            setError("Tu solicitud fue rechazada o ha expirado.");
            setScreenState('error');
        } else if (myRequest.challenge) {
            setChallenge(myRequest.challenge);
            setScreenState('challenge');
        }
    } catch (e) {
        // Ignore polling errors
    }
  }, [requestInfo, screenState]);

  useEffect(() => {
    if (screenState === 'waiting') {
        const interval = setInterval(checkRequestStatus, 2000);
        return () => clearInterval(interval);
    }
  }, [screenState, checkRequestStatus]);
  
  const handleChallengeResponse = async (selection: number) => {
    if (!requestInfo?.id) return;
    setIsSubmitting(true);
    try {
        const res = await fetch('/api/auth-challenge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'respond', requestId: requestInfo.id, selection }),
        });
        const data = await res.json();
        if (data.success && data.authenticated) {
            localStorage.setItem(AUTH_KEY, data.password);
            toast({ title: '¡Acceso Concedido!', description: 'Serás redirigido a los controles.' });
            router.replace('/mobile-controls');
        } else {
            setError(data.message || "Selección incorrecta.");
            setScreenState('error');
        }
    } catch(e) {
        setError("Error de red al enviar la respuesta.");
        setScreenState('error');
    } finally {
        setIsSubmitting(false);
    }
  };


  const renderContent = () => {
    switch(screenState) {
      case 'idle':
        return (
          <>
            <CardHeader>
              <CardTitle>Solicitar Acceso</CardTitle>
              <CardDescription>
                Presiona el botón para solicitar acceso al operador principal. Deberás estar cerca para que vea tu solicitud.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleRequestAccess} className="w-full h-14 text-lg">
                <Send className="mr-2 h-5 w-5" /> Solicitar Acceso
              </Button>
            </CardContent>
          </>
        );
      
      case 'requesting':
        return (
            <CardContent className="flex flex-col items-center justify-center p-8 min-h-[16rem]">
                <HockeyPuckSpinner className="h-16 w-16" />
                <p className="text-muted-foreground mt-4">Enviando solicitud...</p>
            </CardContent>
        );

      case 'waiting':
        return (
            <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[16rem]">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4 animate-pulse" />
                <p className="font-semibold">Solicitud enviada al operador.</p>
                <p className="text-muted-foreground">Esperando aprobación...</p>
            </CardContent>
        );

      case 'challenge':
        return (
          <>
            <CardHeader className="text-center">
              <CardTitle>¡Responde al Desafío!</CardTitle>
              <CardDescription>
                El operador te indicará cuál de los siguientes números debes presionar para obtener acceso.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              <div className="grid grid-cols-5 gap-2 w-full">
                {challenge?.options.map(num => (
                  <Button 
                    key={num} 
                    onClick={() => handleChallengeResponse(num)} 
                    className="aspect-square h-auto text-2xl"
                    disabled={isSubmitting}
                  >
                    {num}
                  </Button>
                ))}
              </div>
              {isSubmitting && <HockeyPuckSpinner className="h-8 w-8 mt-2" />}
            </CardContent>
          </>
        );

      case 'error':
         return (
            <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[16rem] text-destructive">
                <WifiOff className="h-12 w-12 mb-4" />
                <p className="font-semibold">Error</p>
                <p className="text-destructive-foreground/80">{error}</p>
                 <Button onClick={handleRequestAccess} className="mt-6">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reintentar
                </Button>
            </CardContent>
        );
    }
  }

  return (
    <div className="w-full h-full flex flex-col justify-center">
        <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-8">
                <KeyRound className="mx-auto h-12 w-12 text-primary" />
                <h1 className="text-3xl font-bold text-primary-foreground mt-4">Acceso Remoto</h1>
            </div>
            <Card>
              {renderContent()}
            </Card>
        </div>
    </div>
  );
}
