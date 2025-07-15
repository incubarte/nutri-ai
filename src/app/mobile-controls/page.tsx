

"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Team, LiveGameState, PenaltyTypeDefinition } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Goal, Send, Users, Siren, WifiOff, RefreshCw, PlayCircle, ShieldCheck, Crosshair } from 'lucide-react';
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
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" disabled={isSending} className="h-14 text-lg">
            {isSending ? <LoadingSpinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
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
          {isSending ? <LoadingSpinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
          Enviar Penalidad
        </Button>
      </DialogFooter>
    </form>
  );
}


export default function MobileControlsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameState, setGameState] = useState<LiveGameState | null>(null);
  const [config, setConfig] = useState<any>(null); // Store config separately for penalty types
  
  const [isAddGoalDialogOpen, setIsAddGoalDialogOpen] = useState(false);
  const [isAddPenaltyDialogOpen, setIsAddPenaltyDialogOpen] = useState(false);
  const [showPuckInPlayButton, setShowPuckInPlayButton] = useState(false);

  const { toast } = useToast();

  const fetchInitialData = async () => {
    setError(null);
    try {
      // We need config for penalty types, so we fetch both.
      const [gameStateRes, configRes] = await Promise.all([
        fetch('/api/game-state'),
        fetch('/api/config') // Assuming a config endpoint exists
      ]);

      if (!gameStateRes.ok) throw new Error(`Game state fetch failed: ${gameStateRes.status}`);
      if (!configRes.ok) throw new Error(`Config fetch failed: ${configRes.status}`);

      const gameStateData: LiveGameState | null = await gameStateRes.json();
      const configData: any = await configRes.json();
      
      setGameState(gameStateData);
      setConfig(configData);

    } catch (e) {
      console.error("Failed to fetch initial data:", e);
      const errorMessage = e instanceof Error ? e.message : "No se pudo obtener el estado del partido del servidor.";
      setError(errorMessage);
    }
  };

  useEffect(() => {
    const authenticateAndLoad = async () => {
      setIsLoading(true);
      try {
        const password = localStorage.getItem(AUTH_KEY);
        const res = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        const data = await res.json();
        
        if (data.authenticated) {
            await fetchInitialData();
        } else {
            router.replace('/mobile-controls/login');
        }
      } catch (e) {
        console.error("Auth check failed", e);
        setError("Error de autenticación. Intenta de nuevo.");
      } finally {
        setIsLoading(false);
      }
    };
    authenticateAndLoad();
  }, [router]);
  
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
          <ShieldCheck className="h-12 w-12 text-primary animate-pulse" />
          <p className="text-muted-foreground mt-4">Verificando acceso...</p>
        </div>
      </main>
    );
  }
  
  if (error || !gameState || !config) {
    return (
      <main className="w-full h-full p-4 bg-background">
        <div className="flex flex-col h-full w-full items-center justify-center text-center text-destructive">
          <WifiOff className="h-16 w-16" />
          <h1 className="text-2xl font-bold mt-4">Error de Conexión</h1>
          <p className="text-destructive-foreground/80">{error || "No se pudo cargar la información del partido."}</p>
          <Button onClick={fetchInitialData} className="mt-6">
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-md mx-auto space-y-8 pt-8">
      <div className="text-center space-y-2">
        <Users className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-3xl font-bold text-primary-foreground">Control Remoto</h1>
        <p className="text-muted-foreground">
          Acciones rápidas para el operador auxiliar.
        </p>
      </div>
      <Card className="mt-12">
        <CardContent className="p-6 flex flex-col gap-6">
          <Button
            className="w-full h-24 text-2xl font-bold"
            onClick={() => setIsAddGoalDialogOpen(true)}
          >
            <Goal className="mr-4 h-8 w-8" />
            Añadir Gol
          </Button>
          <Button
            className="w-full h-24 text-2xl font-bold"
            onClick={() => router.push('/mobile-controls/shots')}
          >
            <Crosshair className="mr-4 h-8 w-8" />
            Registrar Tiro
          </Button>
           <Button
            className="w-full h-24 text-2xl font-bold"
            onClick={() => setIsAddPenaltyDialogOpen(true)}
            variant="destructive"
          >
            <Siren className="mr-4 h-8 w-8" />
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
            penaltyTypes={config.penaltyTypes || []}
            defaultPenaltyTypeId={config.defaultPenaltyTypeId || null}
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

