
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

const HistoryList = ({ title, items, icon: Icon }: { title: string, items: string[], icon: React.ElementType }) => {
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
                                        <p key={index} className="text-sm border-b pb-1 text-muted-foreground">{item}</p>
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
                                <p className="truncate cursor-default">{item}</p>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{item}</p>
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
  const [transcript, setTranscript] = useState('');
  const [highlightedTranscript, setHighlightedTranscript] = useState<React.ReactNode>(null);

  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>('');

  const [allTranscripts, setAllTranscripts] = useState<string[]>([]);
  const [processedEvents, setProcessedEvents] = useState<string[]>([]);

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

    let processedText = ` ${baseText} `; // Pad with spaces for reliable regex matching
    
    if (!processedText.trim()) return;

    const eventsToDispatch: { index: number; type: 'goal' | 'shot'; payload: any; description: string; match: string }[] = [];
    
    const goalWithAssistRegex = /\bgol\s+(local|loca|visitante|visitantes)\s+(\d+)\s+asistencia\s+(\d+)\b/g;
    const goalWithoutAssistRegex = /\bgol\s+(local|loca|visitante|visitantes)\s+(\d+)(\s+sin\s+asistencia)?\b/g;
    const shotRegex = /\b(local|loca|visitante|visitantes)\s+(\d+)\b/g;
    
    let match;

    // --- 1. Find all potential commands and their positions ---
    while ((match = goalWithAssistRegex.exec(processedText)) !== null) {
        const team: Team = (match[1].startsWith('local') || match[1].startsWith('loca')) ? 'home' : 'away';
        eventsToDispatch.push({
            index: match.index,
            type: 'goal',
            payload: { team, scorerNumber: match[2], assistNumber: match[3] },
            description: `Gol ${team === 'home' ? 'Local' : 'Visitante'} #${match[2]} (Asist. #${match[3]})`,
            match: match[0],
        });
    }
    
    while ((match = goalWithoutAssistRegex.exec(processedText)) !== null) {
        const team: Team = (match[1].startsWith('local') || match[1].startsWith('loca')) ? 'home' : 'away';
        eventsToDispatch.push({
            index: match.index,
            type: 'goal',
            payload: { team, scorerNumber: match[2] },
            description: `Gol ${team === 'home' ? 'Local' : 'Visitante'} #${match[2]}`,
            match: match[0],
        });
    }
    
    while ((match = shotRegex.exec(processedText)) !== null) {
        eventsToDispatch.push({
            index: match.index,
            type: 'shot',
            payload: { team, playerNumber: match[2] },
            description: `Tiro ${team === 'home' ? 'Local' : 'Visitante'} #${match[2]}`,
            match: match[0],
        });
    }

    // --- 2. Remove overlapping matches (e.g., a goal shouldn't also be a shot) ---
    const finalEvents = [];
    const processedIndices = new Set<number>();
    // Sort by length of match, longest first, to prioritize more specific commands (goal over shot)
    eventsToDispatch.sort((a,b) => b.match.length - a.match.length);
    
    for (const event of eventsToDispatch) {
        let isOverlapping = false;
        for (let i = 0; i < event.match.length; i++) {
            if (processedIndices.has(event.index + i)) {
                isOverlapping = true;
                break;
            }
        }
        if (!isOverlapping) {
            finalEvents.push(event);
            for (let i = 0; i < event.match.length; i++) {
                processedIndices.add(event.index + i);
            }
        }
    }
    
    // Sort back by original index to process in spoken order
    finalEvents.sort((a, b) => a.index - b.index);

    // --- 3. Dispatch commands and generate highlighted transcript ---
    const eventsDescriptions: string[] = [];
    let lastIndex = 0;
    const highlightedNodes: React.ReactNode[] = [];

    finalEvents.forEach((event, idx) => {
      // Add unprocessed text before the current match
      if(event.index > lastIndex) {
         highlightedNodes.push(<span key={`unprocessed-${idx}`}>{baseText.substring(lastIndex, event.index)}</span>);
      }
      
      // Add the highlighted match
      const colorClass = event.type === 'goal' ? 'text-green-400 font-bold' : 'text-blue-400 font-semibold';
      highlightedNodes.push(<span key={event.index} className={colorClass}>{event.match}</span>);
      
      lastIndex = event.index + event.match.length;

      // Dispatch the command
      if (event.type === 'goal') {
        sendRemoteCommand({ type: 'ADD_GOAL', payload: event.payload });
        toast({ title: "Comando de Gol Enviado", description: event.description });
      } else if (event.type === 'shot') {
        sendRemoteCommand({ type: 'ADD_SHOT', payload: event.payload });
        toast({ title: "Comando de Tiro Enviado", description: event.description, duration: 1500 });
      }
      eventsDescriptions.push(event.description);
    });

    // Add any remaining unprocessed text at the end
    if(lastIndex < baseText.length) {
        highlightedNodes.push(<span key="unprocessed-end">{baseText.substring(lastIndex)}</span>);
    }
    
    setHighlightedTranscript(<p>{highlightedNodes}</p>);


    if (eventsDescriptions.length > 0) {
      setProcessedEvents(prev => [...eventsDescriptions, `--- Transcripción Finalizada ---`, ...prev].reverse());
    }
  }, [toast]);


  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'es-AR';
    
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
          }
      }
      const cleanedTranscript = finalTranscript.replace(/locallocal/g, 'local').trim();
      finalTranscriptRef.current = cleanedTranscript;
      setTranscript(cleanedTranscript);
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
      const transcriptToProcess = finalTranscriptRef.current;
      
      if (transcriptToProcess) {
        setAllTranscripts(prev => [transcriptToProcess, ...prev]);
        processCommand(transcriptToProcess);
      }
      
      finalTranscriptRef.current = '';
    };

    recognitionRef.current = recognition;
  }, [toast, processCommand]);

  const handleTouchStart = () => {
    if (recognitionRef.current && !isListening) {
        setTranscript('');
        setHighlightedTranscript(null);
        finalTranscriptRef.current = '';
        recognitionRef.current.start();
        setIsListening(true);
    }
  };

  const handleTouchEnd = () => {
    if (recognitionRef.current && isListening) {
        recognitionRef.current.stop();
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
        <p className="text-xs text-muted-foreground">Ej: "Gol Local 10 asistencia 12, visitante 43, local 22"</p>
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
        <HistoryList title="Historial de Eventos Enviados" items={processedEvents} icon={List} />
      </div>

      <div className="text-center mt-4">
        <Badge variant="secondary">Estado Mic: {isListening ? 'Activado' : 'Inactivo'}</Badge>
      </div>
    </main>
  );
}
