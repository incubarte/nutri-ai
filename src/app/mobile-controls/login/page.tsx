
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { KeyRound, Send, RefreshCw, CheckCircle, WifiOff, Fingerprint, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import type { AccessRequest } from '@/types';
import { cn } from '@/lib/utils';

const AUTH_KEY = 'icevision-remote-auth-key';

type AuthScreenState = 'idle' | 'requesting' | 'waiting' | 'approved' | 'error';

export default function LoginPage() {
  const [screenState, setScreenState] = useState<AuthScreenState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [requestInfo, setRequestInfo] = useState<AccessRequest | null>(null);

  const router = useRouter();
  const { toast } = useToast();

  const handleRequestAccess = async () => {
    setScreenState('requesting');
    setError(null);
    try {
      const userAgent = navigator.userAgent;
      const verificationNumber = Math.floor(Math.random() * 100) + 1; // 1 to 100
      
      const res = await fetch('/api/auth-challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', userAgent, verificationNumber }),
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
  
  const checkApprovalStatus = useCallback(async () => {
    if (!requestInfo?.id || screenState !== 'waiting') return;

    try {
        const res = await fetch('/api/auth-challenge/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId: requestInfo.id }),
        });
        
        if (res.status === 404) {
             setError("Tu solicitud fue rechazada o ha expirado.");
             setScreenState('error');
             return;
        }

        if (res.ok) {
            const data = await res.json();
            if (data.approved) {
                localStorage.setItem(AUTH_KEY, data.password);
                setScreenState('approved');
                toast({ title: '¡Acceso Concedido!', description: 'Serás redirigido a los controles.' });
                setTimeout(() => router.replace('/mobile-controls'), 1500);
            }
        }
        // No-op for other statuses, just keep polling.
    } catch (e) {
        // Ignore polling errors to avoid flashing error messages on temporary network issues.
        console.warn("Polling for approval failed, will retry.", e);
    }
  }, [requestInfo, screenState, router, toast]);

  useEffect(() => {
    if (screenState === 'waiting') {
        const interval = setInterval(checkApprovalStatus, 2500);
        return () => clearInterval(interval);
    }
  }, [screenState, checkApprovalStatus]);


  const renderContent = () => {
    switch(screenState) {
      case 'idle':
        return (
          <>
            <CardHeader>
              <CardTitle>Solicitar Acceso</CardTitle>
              <CardDescription>
                Presiona el botón para solicitar acceso al operador principal. Necesitarás decirle el número de verificación que aparece en pantalla.
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
            <CardContent className="flex flex-col items-center justify-center p-8 min-h-[18rem]">
                <HockeyPuckSpinner className="h-16 w-16" />
                <p className="text-muted-foreground mt-4">Enviando solicitud...</p>
            </CardContent>
        );

      case 'waiting':
        return (
            <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[18rem]">
                <Fingerprint className="h-12 w-12 text-blue-500 mb-4 animate-pulse" />
                <p className="font-semibold text-lg">Dile este número al operador:</p>
                <p className="font-bold text-6xl text-primary my-2">{requestInfo?.verificationNumber}</p>
                <p className="text-muted-foreground">Esperando aprobación...</p>
            </CardContent>
        );

      case 'approved':
        return (
            <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[18rem]">
                <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
                <p className="font-semibold text-xl">¡Aprobado!</p>
                <p className="text-muted-foreground">Redirigiendo a los controles...</p>
            </CardContent>
        );

      case 'error':
         return (
            <CardContent className="flex flex-col items-center justify-center p-8 text-center min-h-[18rem] text-destructive">
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
