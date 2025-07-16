
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Goal, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendRemoteCommand } from '@/app/actions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { LiveGameState, AttendedPlayerInfo } from '@/types';
import { Separator } from '@/components/ui/separator';

const AUTH_KEY = 'icevision-remote-auth-key';

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

  useEffect(() => {
    const authenticateAndLoad = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Step 1: Authenticate
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

        // Step 2: Fetch game state which now includes the populated attendance list
        const gameStateRes = await fetch('/api/game-state');
        if (!gameStateRes.ok) {
          throw new Error(`Failed to fetch game state: ${gameStateRes.status}`);
        }
        const liveState: LiveGameState = await gameStateRes.json();

        if (liveState && liveState.gameSummary && liveState.gameSummary.attendance) {
            setHomeTeamName(liveState.homeTeamName || 'Local');
            setAwayTeamName(liveState.awayTeamName || 'Visitante');

            const sortedHomePlayers = [...(liveState.gameSummary.attendance.home || [])].sort((a,b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));
            const sortedAwayPlayers = [...(liveState.gameSummary.attendance.away || [])].sort((a,b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999));

            setHomeAttendedPlayers(sortedHomePlayers);
            setAwayAttendedPlayers(sortedAwayPlayers);
            setHomeShots(liveState.score?.homeShots || 0);
            setAwayShots(liveState.score?.awayShots || 0);

        } else {
            throw new Error("Incomplete game data received from server.");
        }

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Error desconocido";
        setError(errorMessage);
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

      <Button className="w-full h-16 text-xl" onClick={() => router.push('/mobile-controls')}>
        <Goal className="mr-4 h-6 w-6" /> Añadir Gol
      </Button>
    </main>
  );
}
