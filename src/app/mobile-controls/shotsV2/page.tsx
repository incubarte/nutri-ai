
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mic, MicOff, WifiOff, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendRemoteCommand } from '@/app/actions';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import type { LiveGameState, Team, MobileData } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const AUTH_KEY = 'icevision-remote-auth-key';

// Define the interface for the speech recognition object
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
}

export default function MobileShotsV2Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [liveState, setLiveState] = useState<LiveGameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const fetchAndSetState = useCallback(async () => {
    try {
      const initialStateRes = await fetch('/api/game-state');
      if (!initialStateRes.ok) throw new Error("Could not fetch initial game state");
      const initialData: MobileData = await initialStateRes.json();
      
      if (initialData.gameState) {
        setLiveState(initialData.gameState);
        setError(null);
      } else {
        throw new Error("No active game state from server.");
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Error de conexión.";
      console.error("Fetch state failed", e);
      setError(errorMessage);
    }
  }, []);

  useEffect(() => {
    const connect = async () => {
      setIsLoading(true);
      try {
        const password = localStorage.getItem(AUTH_KEY);
        if (!password) {
            router.replace('/mobile-controls/login');
            return;
        }

        const authRes = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        if (!authRes.ok) throw new Error("Authentication failed");
        const authData = await authRes.json();
        
        if (!authData.authenticated) {
            router.replace('/mobile-controls/login');
            return;
        }
        
        await fetchAndSetState();
      } catch (e) {
        setError("Error de autenticación o conexión inicial.");
      } finally {
        setIsLoading(false);
      }
    };
    
    connect();
  }, [router, fetchAndSetState]);

  const processCommand = useCallback((command: string) => {
    let processedCommand = command.toLowerCase().trim();

    // Regex for goals with assists: "gol local 12 asistencia 32"
    const goalWithAssistRegex = /gol\s+(local|loca|visitante|visitantes)\s+(\d+)\s+asistencia\s+(\d+)/g;
    
    // Regex for goals without assists: "gol local 12"
    const goalWithoutAssistRegex = /gol\s+(local|loca|visitante|visitantes)\s+(\d+)/g;

    // Regex for shots: "local 12"
    const shotRegex = /(local|loca|visitante|visitantes)\s+(\d+)/g;

    // Process goals with assists first
    processedCommand = processedCommand.replace(goalWithAssistRegex, (match, teamWord, scorerNumber, assistNumber) => {
        const team: Team = (teamWord === 'local' || teamWord === 'loca') ? 'home' : 'away';
        sendRemoteCommand({ type: 'ADD_GOAL', payload: { team, scorerNumber, assistNumber } });
        toast({ title: "Comando de Gol Enviado", description: `Equipo: ${team}, Gol: #${scorerNumber}, Asist: #${assistNumber}` });
        return ''; // Remove matched part
    });

    // Process goals without assists
    processedCommand = processedCommand.replace(goalWithoutAssistRegex, (match, teamWord, scorerNumber) => {
        const team: Team = (teamWord === 'local' || teamWord === 'loca') ? 'home' : 'away';
        sendRemoteCommand({ type: 'ADD_GOAL', payload: { team, scorerNumber } });
        toast({ title: "Comando de Gol Enviado", description: `Equipo: ${team}, Gol: #${scorerNumber}` });
        return ''; // Remove matched part
    });

    // Process remaining as shots
    processedCommand.replace(shotRegex, (match, teamWord, playerNumber) => {
        const team: Team = (teamWord === 'local' || teamWord === 'loca') ? 'home' : 'away';
        sendRemoteCommand({ type: 'ADD_SHOT', payload: { team, playerNumber } });
        toast({ title: "Comando de Tiro Enviado", description: `Tiro para ${team} #${playerNumber}` });
        return ''; // Remove matched part
    });

  }, [toast]);


  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-AR';
    
    let accumulatedFinalTranscript = '';

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      accumulatedFinalTranscript = ''; // Reset on new result to rebuild from final parts
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          accumulatedFinalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      setTranscript(interimTranscript);
      setFinalTranscript(accumulatedFinalTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error === 'no-speech' || event.error === 'audio-capture') {
        // Ignore these common errors
      } else {
        toast({ title: "Error de Reconocimiento", description: `Error: ${event.error}`, variant: "destructive" });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (finalTranscript.trim()) {
        processCommand(finalTranscript);
      }
       setFinalTranscript(''); // Clear after processing
    };

    recognitionRef.current = recognition;
  }, [toast, processCommand]);

  const handleTouchStart = () => {
    if (recognitionRef.current && !isListening) {
        setTranscript('');
        setFinalTranscript('');
        recognitionRef.current.start();
        setIsListening(true);
    }
  };

  const handleTouchEnd = () => {
    if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
        // onend will handle the rest
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <HockeyPuckSpinner className="h-24 w-24" />
      </div>
    );
  }

  if (error || !liveState) {
     return (
      <div className="flex flex-col justify-center items-center h-screen text-center text-destructive p-4">
       <WifiOff className="h-12 w-12 mb-4" />
       <p className="font-semibold">{error || 'No se pudo obtener el estado del partido.'}</p>
        <Button onClick={() => window.location.reload()} className="mt-6">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
        </Button>
      </div>
    );
  }
  
  if (!isSupported) {
    return (
        <main className="w-full max-w-lg mx-auto p-4 space-y-6 flex flex-col items-center justify-center h-full text-center">
            <h1 className="text-2xl font-bold text-destructive">Navegador no Soportado</h1>
            <p className="text-muted-foreground">La función de reconocimiento de voz no es compatible con tu navegador actual. Por favor, usa Google Chrome o Microsoft Edge en Android o en una computadora de escritorio para esta funcionalidad.</p>
            <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Volver
            </Button>
        </main>
    );
  }


  return (
    <main className="w-full max-w-lg mx-auto p-4 space-y-6 flex flex-col h-[80vh]">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-primary-foreground">Registrar con Voz</h1>
      </div>
      <div className="text-center">
        <p className="text-muted-foreground">Mantén presionado el botón y habla.</p>
        <p className="text-xs text-muted-foreground">Ej: "Local 25, gol visitante 10 asistencia 22"</p>
      </div>
      
      <div className="flex-grow flex flex-col items-center justify-center">
          <Button
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            className={cn(
                "w-48 h-48 rounded-full transition-all duration-200 flex flex-col",
                isListening ? "bg-destructive animate-pulse" : "bg-primary"
            )}
          >
              {isListening ? <Mic className="h-20 w-20" /> : <MicOff className="h-20 w-20" />}
              <span className="mt-2 text-lg">{isListening ? 'Escuchando...' : 'Presiona'}</span>
          </Button>
      </div>
      
      <Card className="min-h-[100px]">
        <CardHeader>
            <CardTitle className="text-lg">Transcripción en vivo</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground italic">
                {transcript || 'Esperando dictado...'}
            </p>
        </CardContent>
      </Card>
      <div className="text-center">
        <Badge variant="secondary">Estado: {isListening ? 'Activado' : 'Inactivo'}</Badge>
      </div>
    </main>
  );
}

