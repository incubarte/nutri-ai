
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Goal, ArrowLeft, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendRemoteCommand } from '@/app/actions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { LiveGameState, AttendedPlayerInfo, Team, MobileData } from '@/types';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';


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
            {isSending ? <LoadingSpinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar Gol
          </Button>
        </DialogFooter>
      </form>
    );
}

export default function MobileShotsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [homeTeamName, setHomeTeamName] = useState<string>('Local');
  const [awayTeamName, setAwayTeamName] = useState<string>('Visitante');
  const [homeAttendedPlayers, setHomeAttendedPlayers] = useState<AttendedPlayerInfo[]>([]);
  const [awayAttendedPlayers, setAwayAttendedPlayers] = useState<AttendedPlayerInfo[]>([]);
  const [homeShots, setHomeShots] = useState(0);
  const [awayShots, setAwayShots] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isAddGoalDialogOpen, setIsAddGoalDialogOpen] = useState(false);

  useEffect(() => {
    const authenticateAndLoad = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const password = localStorage.getItem(AUTH_KEY);
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

        const gameStateRes = await fetch('/api/game-state');
        if (!gameStateRes.ok) {
          throw new Error(`Failed to fetch game state: ${gameStateRes.status}`);
        }
        const mobileData: MobileData = await gameStateRes.json();
        const liveState = mobileData.gameState;

        if (liveState && liveState.gameSummary) {
            setHomeTeamName(liveState.homeTeamName || 'Local');
            setAwayTeamName(liveState.awayTeamName || 'Visitante');

            const homeAttendance = liveState.gameSummary.attendance?.home || [];
            const awayAttendance = liveState.gameSummary.attendance?.away || [];

            const sortedHomePlayers = [...homeAttendance].sort((a,b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));
            const sortedAwayPlayers = [...awayAttendance].sort((a,b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));

            setHomeAttendedPlayers(sortedHomePlayers);
            setAwayAttendedPlayers(sortedAwayPlayers);
            setHomeShots(liveState.score?.homeShots || 0);
            setAwayShots(liveState.score?.awayShots || 0);

        } else {
            throw new Error("Incomplete game data received from server.");
        }

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Error desconocido";
        setError(`Error reaching server. ${errorMessage}`);
        console.error("Error loading shots page:", e);
      } finally {
        setIsLoading(false);
      }
    };

    authenticateAndLoad();
  }, [router]);

  const handleShot = async (team: 'home' | 'away', playerNumber: string) => {
    if (!playerNumber) {
        toast({ title: "Error", description: "El jugador no tiene un número asignado.", variant: 'destructive' });
        return;
    }
    const result = await sendRemoteCommand({ type: 'ADD_SHOT', payload: { team, playerNumber } });
    if (result.success) {
      if (team === 'home') setHomeShots(s => s + 1);
      if (team === 'away') setAwayShots(s => s + 1);
      toast({
        title: "Tiro Registrado",
        description: `Tiro para el jugador #${playerNumber} del equipo ${team === 'home' ? homeTeamName : awayTeamName}.`,
        duration: 1500,
      });
    } else {
      toast({ title: "Error", description: result.message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner className="h-8 w-8" />
      </div>
    );
  }

  if (error) {
     return (
      <div className="flex justify-center items-center h-screen text-center text-destructive p-4">
       <p>{error}</p>
      </div>
    );
  }

  return (
    <main className="w-full max-w-lg mx-auto p-4 space-y-6">
       <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold text-primary-foreground">Registrar Tiros</h1>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-3">
            <h2 className="text-center font-bold text-lg mb-1 truncate">{homeTeamName}</h2>
            <p className="text-center text-sm text-muted-foreground mb-2">Tiros Totales: {homeShots}</p>
            <div className="grid grid-cols-3 gap-2">
              {homeAttendedPlayers.map(player => (
                <Button key={player.id} onClick={() => handleShot('home', player.number)} className="h-16 text-xl">
                  {player.number}
                </Button>
              ))}
            </div>
            {homeAttendedPlayers.length === 0 && <p className="text-center text-sm text-muted-foreground p-4">Sin jugadores</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <h2 className="text-center font-bold text-lg mb-1 truncate">{awayTeamName}</h2>
             <p className="text-center text-sm text-muted-foreground mb-2">Tiros Totales: {awayShots}</p>
            <div className="grid grid-cols-3 gap-2">
               {awayAttendedPlayers.map(player => (
                <Button key={player.id} onClick={() => handleShot('away', player.number)} className="h-16 text-xl">
                  {player.number}
                </Button>
              ))}
            </div>
            {awayAttendedPlayers.length === 0 && <p className="text-center text-sm text-muted-foreground p-4">Sin jugadores</p>}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Button className="w-full h-16 text-xl" onClick={() => setIsAddGoalDialogOpen(true)}>
        <Goal className="mr-4 h-6 w-6" /> Añadir Gol
      </Button>

      <Dialog open={isAddGoalDialogOpen} onOpenChange={setIsAddGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar un Nuevo Gol</DialogTitle>
            <DialogDescription>
              Selecciona el equipo y los números de los jugadores. El comando será enviado al operador principal.
            </DialogDescription>
          </DialogHeader>
          <AddGoalForm 
            homeTeamName={homeTeamName}
            awayTeamName={awayTeamName}
            onGoalSent={() => setIsAddGoalDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
