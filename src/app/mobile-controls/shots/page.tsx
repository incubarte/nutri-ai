
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Goal, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendRemoteCommand } from '@/app/actions';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import type { TeamData } from '@/types';
import { useGameState } from '@/contexts/game-state-context';
import { Separator } from '@/components/ui/separator';

const AUTH_KEY = 'icevision-remote-auth-key';

export default function MobileShotsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [homeTeam, setHomeTeam] = useState<TeamData | null>(null);
  const [awayTeam, setAwayTeam] = useState<TeamData | null>(null);
  const { state: liveState } = useGameState(); // Use live state to find teams

  useEffect(() => {
    const authenticateAndLoad = async () => {
      setIsLoading(true);
      const password = localStorage.getItem(AUTH_KEY);
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      
      if (!data.authenticated) {
        router.replace('/mobile-controls/login');
        return;
      }

      if (liveState && liveState.config && liveState.live) {
        const { config, live } = liveState;
        
        const findTeam = (name: string, subName?: string) => {
          return config.teams.find(t => 
            t.name === name && 
            (t.subName || undefined) === (subName || undefined) &&
            t.category === config.selectedMatchCategory
          );
        };

        const homeTeamData = findTeam(live.homeTeamName, live.homeTeamSubName);
        const awayTeamData = findTeam(live.awayTeamName, live.awayTeamSubName);

        const homeAttendance = new Set(live.gameSummary?.attendance?.home || []);
        const awayAttendance = new Set(live.gameSummary?.attendance?.away || []);

        setHomeTeam(homeTeamData ? {
          ...homeTeamData,
          players: homeTeamData.players
            .filter(p => homeAttendance.has(p.id))
            .sort((a,b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999))
        } : null);

        setAwayTeam(awayTeamData ? {
          ...awayTeamData,
          players: awayTeamData.players
            .filter(p => awayAttendance.has(p.id))
            .sort((a,b) => (parseInt(a.number) || 999) - (parseInt(b.number) || 999))
        } : null);
      }
      setIsLoading(false);
    };

    authenticateAndLoad();
  }, [router, liveState]);

  const handleShot = async (team: 'home' | 'away', playerNumber: string) => {
    const result = await sendRemoteCommand({ type: 'ADD_SHOT', payload: { team, playerNumber } });
    if (result.success) {
      toast({
        title: "Tiro Registrado",
        description: `Tiro para el jugador #${playerNumber} del equipo ${team === 'home' ? homeTeam?.name : awayTeam?.name}.`,
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
            <h2 className="text-center font-bold text-lg mb-2 truncate">{homeTeam?.name || 'Local'}</h2>
            <div className="grid grid-cols-3 gap-2">
              {homeTeam?.players.map(player => (
                <Button key={player.id} onClick={() => handleShot('home', player.number)} className="h-16 text-xl">
                  {player.number}
                </Button>
              ))}
            </div>
            {(!homeTeam || homeTeam.players.length === 0) && <p className="text-center text-sm text-muted-foreground p-4">Sin jugadores</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <h2 className="text-center font-bold text-lg mb-2 truncate">{awayTeam?.name || 'Visitante'}</h2>
            <div className="grid grid-cols-3 gap-2">
               {awayTeam?.players.map(player => (
                <Button key={player.id} onClick={() => handleShot('away', player.number)} className="h-16 text-xl">
                  {player.number}
                </Button>
              ))}
            </div>
            {(!awayTeam || awayTeam.players.length === 0) && <p className="text-center text-sm text-muted-foreground p-4">Sin jugadores</p>}
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
