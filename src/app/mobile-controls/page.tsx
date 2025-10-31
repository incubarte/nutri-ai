

"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Team, LiveGameState, PenaltyTypeDefinition, MobileData, Penalty } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Goal, Send, Users, Siren, WifiOff, RefreshCw, PlayCircle, ShieldCheck, Crosshair, Hourglass, Mic } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendRemoteCommand } from '../actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { HockeyPuckSpinner } from '@/components/ui/hockey-puck-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useGameState, formatTime, getPeriodContextFromAbsoluteTime } from '@/contexts/game-state-context';

const AUTH_KEY = 'icevision-remote-auth-key';

function AddGoalForm({ homeTeamName, awayTeamName, onGoalSent }: { homeTeamName: string; awayTeamName: string; onGoalSent: () => void }) {
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [scorerNumber, setScorerNumber] = useState('');
    const [assistNumber, setAssistNumber] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTeam) {
        toast({ title: "Error", description: "Debes seleccionar un equipo.", variant: "destructive" });
        return;
      }
      if (!scorerNumber.trim()) {
        toast({ title: "Error", description: "El número del goleador es obligatorio.", variant: "destructive" });
        return;
      }
  
      setIsSending(true);
      const result = await sendRemoteCommand({
        type: 'ADD_GOAL',
        payload: {
          team: selectedTeam,
          scorerNumber: scorerNumber.trim(),
          assistNumber: assistNumber.trim() || undefined,
        }
      });
      setIsSending(false);
  
      if (result.success) {
        toast({ title: "Comando Enviado", description: "El gol ha sido enviado al operador principal." });
        onGoalSent(); // Close dialog
      } else {
        toast({ title: "Error al Enviar", description: result.message, variant: "destructive" });
      }
    };
  
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label className="text-base">Equipo que Anotó</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              type="button"
              variant={selectedTeam === 'home' ? 'default' : 'outline'}
              onClick={() => setSelectedTeam('home')}
              className="h-12 text-base truncate"
              title={homeTeamName}
            >
              {homeTeamName}
            </Button>
            <Button
              type="button"
              variant={selectedTeam === 'away' ? 'default' : 'outline'}
              onClick={() => setSelectedTeam('away')}
              className="h-12 text-base truncate"
              title={awayTeamName}
            >
              {awayTeamName}
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="scorer-number"># Goleador</Label>
            <Input
              id="scorer-number"
              type="number"
              inputMode="numeric"
              value={scorerNumber}
              onChange={(e) => setScorerNumber(e.target.value)}
              placeholder="Ej: 99"
              className="h-12 text-lg"
              required
            />
          </div>
          <div>
            <Label htmlFor="assist-number"># Asistente</Label>
            <Input
              id="assist-number"
              type="number"
              inputMode="numeric"
              value={assistNumber}
              onChange={(e) => setAssistNumber(e.target.value)}
              placeholder="(Opcional)"
              className="h-12 text-lg"
            />
          </div>
        </div>

        <DialogFooter className="pt-6">
          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          <Button type="submit" disabled={isSending} className="h-14 text-lg">
            {isSending ? <HockeyPuckSpinner className="h-6 w-6 mr-2" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar Gol
          </Button>
        </DialogFooter>
      </form>
    );
}

function AddPenaltyForm({ homeTeamName, awayTeamName, penaltyTypes, defaultPenaltyTypeId, onPenaltySent }: { homeTeamName: string; awayTeamName: string; penaltyTypes: PenaltyTypeDefinition[]; defaultPenaltyTypeId: string | null; onPenaltySent: () => void }) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [playerNumber, setPlayerNumber] = useState('');
  const [penaltyTypeId, setPenaltyTypeId] = useState<string | null>(defaultPenaltyTypeId);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPenaltyTypeId(defaultPenaltyTypeId);
  }, [defaultPenaltyTypeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) {
      toast({ title: "Error", description: "Debes seleccionar un equipo.", variant: "destructive" });
      return;
    }
    if (!playerNumber.trim()) {
      toast({ title: "Error", description: "El número del jugador es obligatorio.", variant: "destructive" });
      return;
    }
    if (!penaltyTypeId) {
      toast({ title: "Error", description: "Debes seleccionar un tipo de falta.", variant: "destructive" });
      return;
    }

    setIsSending(true);
    const result = await sendRemoteCommand({
      type: 'ADD_PENALTY',
      payload: {
        team: selectedTeam,
        playerNumber: playerNumber.trim(),
        penaltyTypeId: penaltyTypeId,
      }
    });
    setIsSending(false);

    if (result.success) {
      toast({ title: "Comando Enviado", description: "La penalidad ha sido enviada al operador principal." });
      onPenaltySent();
    } else {
      toast({ title: "Error al Enviar", description: result.message, variant: "destructive" });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label className="text-base">Equipo Sancionado</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            type="button"
            variant={selectedTeam === 'home' ? 'default' : 'outline'}
            onClick={() => setSelectedTeam('home')}
            className="h-12 text-base truncate"
            title={homeTeamName}
          >
            {homeTeamName}
          </Button>
          <Button
            type="button"
            variant={selectedTeam === 'away' ? 'default' : 'outline'}
            onClick={() => setSelectedTeam('away')}
            className="h-12 text-base truncate"
            title={awayTeamName}
          >
            {awayTeamName}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="penalty-player-number"># Jugador</Label>
          <Input
            id="penalty-player-number"
            type="number"
            inputMode="numeric"
            value={playerNumber}
            onChange={(e) => setPlayerNumber(e.target.value)}
            placeholder="Ej: 99"
            className="h-12 text-lg"
            required
          />
        </div>
        <div>
          <Label htmlFor="penalty-type">Tipo de Falta</Label>
          <Select value={penaltyTypeId || ""} onValueChange={setPenaltyTypeId}>
              <SelectTrigger id="penalty-type" className="h-12 text-base">
                  <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                  {penaltyTypes.map(pt => (
                      <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                  ))}
                  {penaltyTypes.length === 0 && <SelectItem value="no-types" disabled>No hay tipos</SelectItem>}
              </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter className="pt-6">
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancelar</Button>
        </DialogClose>
        <Button type="submit" disabled={isSending} className="h-14 text-lg">
          {isSending ? <HockeyPuckSpinner className="h-6 w-6 mr-2" /> : <Send className="mr-2 h-4 w-4" />}
          Enviar Penalidad
        </Button>
      </DialogFooter>
    </form>
  );
}

const statusTextMap: Record<NonNullable<Penalty['_status']>, string> = {
  running: 'Corriendo',
  pending_concurrent: 'Esperando Slot',
  pending_puck: 'Esperando Puck',
};

function MiniScoreboardDisplay({ gameState }: { gameState: LiveGameState }) {
  const { state: fullGameState } = useGameState(); // Access full state for context calculations
  
  if (!gameState || !fullGameState.config) return null;

  const { score, penalties, homeTeamName, awayTeamName } = gameState;
  
  const getPenaltyDisplay = (p: Penalty) => {
    const playerIdentifier = p.isBenchPenalty ? `Banco (#${p.playerNumber})` : `#${p.playerNumber}`;

    let statusInfo = '';
    if (p._status === 'running' && p.expirationTime !== undefined) {
      const expirationContext = getPeriodContextFromAbsoluteTime(p.expirationTime, fullGameState);
      statusInfo = `(${formatTime(expirationContext.timeInPeriodCs)}, ${expirationContext.periodText})`;
    } else if (p._status) {
      statusInfo = `(${statusTextMap[p._status]})`;
    }
    
    return (
      <div 
        key={p.id} 
        className="flex items-center gap-2 text-xs"
      >
        <Hourglass className="h-3 w-3 shrink-0" />
        <span>{playerIdentifier}</span>
        <span className="text-muted-foreground">{statusInfo}</span>
      </div>
    );
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Home Team Column */}
          <div className="text-center space-y-2">
            <h3 className="font-bold text-lg truncate" title={homeTeamName}>{homeTeamName}</h3>
            <p className="text-5xl font-bold text-accent">{score.home}</p>
            <Separator />
            <div className="text-left space-y-1 pt-2 min-h-[5rem]">
              <h4 className="font-semibold text-sm text-muted-foreground">Penalidades</h4>
              {penalties.home.length > 0 ? (
                penalties.home.map(getPenaltyDisplay)
              ) : (
                <p className="text-xs text-muted-foreground italic">Ninguna</p>
              )}
            </div>
          </div>
          {/* Away Team Column */}
          <div className="text-center space-y-2">
            <h3 className="font-bold text-lg truncate" title={awayTeamName}>{awayTeamName}</h3>
            <p className="text-5xl font-bold text-accent">{score.away}</p>
            <Separator />
            <div className="text-left space-y-1 pt-2 min-h-[5rem]">
               <h4 className="font-semibold text-sm text-muted-foreground">Penalidades</h4>
               {penalties.away.length > 0 ? (
                penalties.away.map(getPenaltyDisplay)
              ) : (
                <p className="text-xs text-muted-foreground italic">Ninguna</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MobileControlsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileData, setMobileData] = useState<MobileData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  const [isAddGoalDialogOpen, setIsAddGoalDialogOpen] = useState(false);
  const [isAddPenaltyDialogOpen, setIsAddPenaltyDialogOpen] = useState(false);
  const [showPuckInPlayButton, setShowPuckInPlayButton] = useState(false);

  const { toast } = useToast();

  const fetchAndSetMobileData = useCallback(async () => {
    try {
      const res = await fetch('/api/game-state');
      if (!res.ok) throw new Error(`Game state fetch failed: ${res.status}`);
      const data: MobileData = await res.json();
      setMobileData(data);
      setError(null);
    } catch (e) {
      console.error("Failed to fetch mobile data:", e);
      setError("No se pudo obtener el estado del partido del servidor.");
    }
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = async () => {
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
        const authData = await authRes.json();
        
        if (!authData.authenticated) {
            router.replace('/mobile-controls/login');
            return;
        }

        await fetchAndSetMobileData();
        setIsLoading(false);

        eventSource = new EventSource('/api/game-state/events');
        eventSource.onopen = () => {
          setIsConnected(true);
          setError(null);
        };
        eventSource.onmessage = (event) => {
          try {
            const updatedLiveState: LiveGameState = JSON.parse(event.data);
            setMobileData(prevData => ({
                gameState: updatedLiveState,
                penaltyConfig: prevData?.penaltyConfig || { penaltyTypes: updatedLiveState.penaltyTypes || [], defaultPenaltyTypeId: updatedLiveState.defaultPenaltyTypeId || null }
            }));
          } catch(e) {
             console.error("Error parsing SSE data", e);
          }
        };
        eventSource.onerror = () => {
          setIsConnected(false);
          setError("Conexión perdida con el servidor. Intentando reconectar...");
        }

      } catch (e) {
        console.error("Auth or initial fetch failed", e);
        setError("Error de autenticación o conexión inicial.");
        setIsLoading(false);
      }
    };
    
    connect();

    return () => {
        if (eventSource) {
            eventSource.close();
        }
    }
  }, [router, fetchAndSetMobileData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAndSetMobileData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAndSetMobileData]);
  
  const handlePuckInPlay = async () => {
    const result = await sendRemoteCommand({ type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
    if (result.success) {
      toast({ title: "Comando Enviado", description: "'Puck en Juego' enviado al operador." });
      setShowPuckInPlayButton(false);
    } else {
      toast({ title: "Error al Enviar", description: result.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <main className="w-full h-full p-4 bg-background">
        <div className="flex flex-col h-full w-full items-center justify-center text-center">
          <HockeyPuckSpinner className="h-24 w-24" />
          <p className="text-muted-foreground mt-4">Verificando acceso y cargando datos...</p>
        </div>
      </main>
    );
  }
  
  if (error || !mobileData || !mobileData.gameState) {
    return (
      <main className="w-full h-full p-4 bg-background">
        <div className="flex flex-col h-full w-full items-center justify-center text-center text-destructive">
          <WifiOff className="h-16 w-16" />
          <h1 className="text-2xl font-bold mt-4">Error de Conexión</h1>
          <p className="text-destructive-foreground/80">{error || "No se pudo cargar la información del partido."}</p>
          <Button onClick={() => window.location.reload()} className="mt-6">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </main>
    );
  }

  const { gameState, penaltyConfig } = mobileData;

  return (
    <main className="w-full max-w-md mx-auto p-4 space-y-6 pb-8">
      <div className="text-center space-y-2 pt-4">
        <Users className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-3xl font-bold text-primary-foreground">Control Remoto</h1>
        <p className="text-muted-foreground">
          Acciones rápidas para el operador auxiliar.
        </p>
      </div>
      <Card>
        <CardContent className="p-6 flex flex-col gap-6">
          <Button
            className="w-full h-16 text-xl font-bold"
            onClick={() => setIsAddGoalDialogOpen(true)}
          >
            <Goal className="mr-4 h-6 w-6" />
            Añadir Gol
          </Button>
          <Button
            className="w-full h-16 text-xl font-bold"
            onClick={() => router.push('/mobile-controls/shots')}
          >
            <Crosshair className="mr-4 h-6 w-6" />
            Registrar Tiro
          </Button>
          <Button
            className="w-full h-16 text-xl font-bold"
            onClick={() => router.push('/mobile-controls/shotsV2')}
            variant="secondary"
          >
            <Mic className="mr-4 h-6 w-6" />
            Registrar con Voz (Beta)
          </Button>
           <Button
            className="w-full h-16 text-xl font-bold"
            onClick={() => setIsAddPenaltyDialogOpen(true)}
            variant="destructive"
          >
            <Siren className="mr-4 h-6 w-6" />
            Añadir Penalidad
          </Button>
          {showPuckInPlayButton && (
             <Button
                className="w-full h-20 text-xl font-bold"
                onClick={handlePuckInPlay}
                variant="outline"
             >
                <PlayCircle className="mr-4 h-7 w-7 text-green-500" />
                Puck en Juego
             </Button>
          )}
        </CardContent>
      </Card>
      
      <Separator />

      <MiniScoreboardDisplay gameState={gameState} />


      <Dialog open={isAddGoalDialogOpen} onOpenChange={setIsAddGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar un Nuevo Gol</DialogTitle>
            <DialogDescription>
              Selecciona el equipo y los números de los jugadores. El comando será enviado al operador principal.
            </DialogDescription>
          </DialogHeader>
          <AddGoalForm 
            homeTeamName={gameState.homeTeamName || 'Local'}
            awayTeamName={gameState.awayTeamName || 'Visitante'}
            onGoalSent={() => setIsAddGoalDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
      
      <Dialog open={isAddPenaltyDialogOpen} onOpenChange={setIsAddPenaltyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar una Nueva Penalidad</DialogTitle>
            <DialogDescription>
              Selecciona el equipo, el número del jugador y la duración de la falta.
            </DialogDescription>
          </DialogHeader>
          <AddPenaltyForm 
            homeTeamName={gameState.homeTeamName || 'Local'}
            awayTeamName={gameState.awayTeamName || 'Visitante'}
            penaltyTypes={penaltyConfig.penaltyTypes || []}
            defaultPenaltyTypeId={penaltyConfig.defaultPenaltyTypeId || null}
            onPenaltySent={() => {
              setIsAddPenaltyDialogOpen(false);
              setShowPuckInPlayButton(true);
            }}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
