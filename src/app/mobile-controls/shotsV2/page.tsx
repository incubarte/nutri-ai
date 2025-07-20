
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mic, MicOff, WifiOff, RefreshCw, List, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendRemoteCommand } from '@/app/actions';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import type { LiveGameState, Team, MobileData } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

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

const HistoryList = ({ title, items, icon: Icon }: { title: string, items: React.ReactNode[], icon: React.ElementType }) => {
    const visibleItems = items.slice(0, 10);
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span>{title}</span>
                    </div>
                     <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={items.length === 0}>Ver todo</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>Historial Completo: {title}</DialogTitle>
                                <DialogDescription>Lista completa de todos los items registrados.</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="h-72 my-4 pr-3">
                                <div className="space-y-1">
                                    {items.length > 0 ? items.map((item, index) => (
                                        <div key={index} className="text-sm border-b pb-1 text-muted-foreground">{item}</div>
                                    )) : <p className="text-sm text-center text-muted-foreground">No hay items.</p>}
                                </div>
                            </ScrollArea>
                            <DialogFooter>
                                <DialogClose asChild>
                                    <Button>Cerrar</Button>
                                </DialogClose>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-1 text-sm text-muted-foreground">
                    <TooltipProvider delayDuration={100}>
                    {visibleItems.length > 0 ? visibleItems.map((item, index) => (
                        <Tooltip key={index}>
                            <TooltipTrigger asChild>
                                <div className="truncate cursor-default">{item}</div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div>{item}</div>
                            </TooltipContent>
                        </Tooltip>
                    )) : <p className="italic">No hay items aún.</p>}
                    </TooltipProvider>
                    {items.length > 10 && <p className="text-xs text-center pt-1">...y {items.length - 10} más.</p>}
                </div>
            </CardContent>
        </Card>
    );
};


export default function MobileShotsV2Page() {
  const router = useRouter();
  const { toast } = useToast();
  const [liveState, setLiveState] = useState<LiveGameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [highlightedTranscript, setHighlightedTranscript] = useState<React.ReactNode>(null);

  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [allTranscripts, setAllTranscripts] = useState<React.ReactNode[]>([]);
  const [processedEvents, setProcessedEvents] = useState<React.ReactNode[]>([]);

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
    let baseText = command.toLowerCase().trim();
    // Sanitization
    baseText = baseText.replace(/locallocal/g, 'local');
    baseText = baseText.replace(/\s+de\s+/g, ' ');
    baseText = baseText.replace(/\bgolf\b/g, 'gol');
    baseText = baseText.replace(/\basistente\b/g, 'asistencia');

    if (!baseText) return;
    
    // Use an array of objects to store commands and their original positions
    const eventsToDispatch: { index: number; type: 'goal' | 'shot'; payload: any; description: string; match: string; length: number }[] = [];
    
    const goalWithAssistRegex = /\bgol\s+(local|loca|visitante|visitantes)\s+(\d+)\s+asistencia\s+(\d+)\b/g;
    const goalWithoutAssistRegex = /\bgol\s+(local|loca|visitante|visitantes)\s+(\d+)(\s+sin\s+asistencia)?\b/g;
    const shotRegex = /\b(local|loca|visitante|visitantes)\s+(\d+)\b/g;
    
    let match;

    // --- 1. Find all potential commands ---
    let textForSimpleGoals = baseText;
    while ((match = goalWithAssistRegex.exec(textForSimpleGoals)) !== null) {
        const team: Team = (match[1].startsWith('local') || match[1].startsWith('loca')) ? 'home' : 'away';
        eventsToDispatch.push({
            index: match.index,
            type: 'goal',
            payload: { team, scorerNumber: match[2], assistNumber: match[3] },
            description: `Gol ${team === 'home' ? 'Local' : 'Visitante'} #${match[2]} (Asist. #${match[3]})`,
            match: match[0],
            length: match[0].length,
        });
        // Replace matched part to avoid re-matching
        textForSimpleGoals = textForSimpleGoals.substring(0, match.index) + ' '.repeat(match[0].length) + textForSimpleGoals.substring(match.index + match[0].length);
    }
    
    let textForShots = textForSimpleGoals;
    while ((match = goalWithoutAssistRegex.exec(textForShots)) !== null) {
        const team: Team = (match[1].startsWith('local') || match[1].startsWith('loca')) ? 'home' : 'away';
        eventsToDispatch.push({
            index: match.index,
            type: 'goal',
            payload: { team, scorerNumber: match[2] },
            description: `Gol ${team === 'home' ? 'Local' : 'Visitante'} #${match[2]}`,
            match: match[0],
            length: match[0].length,
        });
        // Replace matched part
        textForShots = textForShots.substring(0, match.index) + ' '.repeat(match[0].length) + textForShots.substring(match.index + match[0].length);
    }
    
    while ((match = shotRegex.exec(textForShots)) !== null) {
        const team: Team = (match[1].startsWith('local') || match[1].startsWith('loca')) ? 'home' : 'away';
        eventsToDispatch.push({
            index: match.index,
            type: 'shot',
            payload: { team, playerNumber: match[2] },
            description: `Tiro ${team === 'home' ? 'Local' : 'Visitante'} #${match[2]}`,
            match: match[0],
            length: match[0].length,
        });
    }
    
    // --- 2. Sort all found events by their original position in the text ---
    eventsToDispatch.sort((a, b) => a.index - b.index);

    // --- 3. Dispatch commands and generate highlighted transcript ---
    const eventsDescriptions: React.ReactNode[] = [];
    let lastIndex = 0;
    const highlightedNodes: React.ReactNode[] = [];

    eventsToDispatch.forEach((event, idx) => {
      // Add unprocessed text before the current match
      if(event.index > lastIndex) {
         highlightedNodes.push(<span key={`unprocessed-${idx}`}>{baseText.substring(lastIndex, event.index)}</span>);
      }
      
      // Add the highlighted match
      const colorClass = event.type === 'goal' ? 'text-green-400 font-bold' : 'text-blue-400 font-semibold';
      highlightedNodes.push(<span key={event.index} className={colorClass}>{event.match}</span>);
      
      lastIndex = event.index + event.length;

      // Dispatch the command
      if (event.type === 'goal') {
        sendRemoteCommand({ type: 'ADD_GOAL', payload: event.payload });
        toast({ title: "Comando de Gol Enviado", description: event.description });
      } else if (event.type === 'shot') {
        sendRemoteCommand({ type: 'ADD_SHOT', payload: event.payload });
        toast({ title: "Comando de Tiro Enviado", description: event.description, duration: 1500 });
      }
      eventsDescriptions.push(<span key={idx} className={colorClass}>{event.description}</span>);
    });

    // Add any remaining unprocessed text at the end
    if(lastIndex < baseText.length) {
        highlightedNodes.push(<span key="unprocessed-end">{baseText.substring(lastIndex)}</span>);
    }
    
    const finalHighlightedTranscript = <p>{highlightedNodes}</p>;
    setHighlightedTranscript(finalHighlightedTranscript);
    setFinalTranscript(baseText);

    if (eventsDescriptions.length > 0) {
      setAllTranscripts(prev => [finalHighlightedTranscript, ...prev]);
      setProcessedEvents(prev => [...eventsDescriptions, <Separator key={`sep-${Date.now()}`} className="my-2" />, ...prev]);
    }
  }, [toast]);


  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'es-AR';
    
    recognition.onresult = (event: any) => {
      let final_transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final_transcript += event.results[i][0].transcript;
        }
      }
      
      const cleanedTranscript = final_transcript.replace(/locallocal/g, 'local').trim();
      
      if (cleanedTranscript) {
        setHighlightedTranscript(<p className="italic text-muted-foreground">{cleanedTranscript}</p>);
        processCommand(cleanedTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (event.error !== 'no-speech' && event.error !== 'audio-capture' && event.error !== 'aborted') {
        toast({ title: "Error de Reconocimiento", description: `Error: ${event.error}`, variant: "destructive" });
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [toast, processCommand]);

  const handleTouchStart = () => {
    if (recognitionRef.current && !isListening) {
        setLiveTranscript('');
        setFinalTranscript('');
        setHighlightedTranscript(null);
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.error("Could not start recognition", e);
          setIsListening(false);
        }
    }
  };

  const handleTouchEnd = () => {
    if (recognitionRef.current && isListening) {
        try {
          recognitionRef.current.stop();
        } catch(e) {
          console.error("Could not stop recognition", e);
        }
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
    <main className="w-full max-w-2xl mx-auto p-4 space-y-4">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-primary-foreground">Registrar con Voz</h1>
      </div>
      <div className="text-center">
        <p className="text-muted-foreground">Mantén presionado el botón y habla.</p>
        <p className="text-xs text-muted-foreground">Ej: "Gol Local 10 asistencia 12, visitante 43"</p>
      </div>
      
      <div className="flex flex-col items-center justify-center py-4">
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
      
      <Card className="min-h-[80px]">
        <CardHeader className="py-2">
            <CardTitle className="text-sm font-medium">Transcripción Procesada</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
            <div className="text-muted-foreground italic">
                {highlightedTranscript || (isListening ? 'Escuchando...' : 'Esperando dictado...')}
            </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <HistoryList title="Historial de Transcripciones" items={allTranscripts} icon={History} />
        <HistoryList title="Últimos Eventos Enviados" items={processedEvents} icon={List} />
      </div>

      <div className="text-center mt-4">
        <Badge variant="secondary">Estado Mic: {isListening ? 'Activado' : 'Inactivo'}</Badge>
      </div>
    </main>
  );
}
