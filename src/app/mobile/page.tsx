
"use client";

import { useState, useEffect } from 'react';
import type { LiveGameState, ClockState, Penalty } from '@/types';
import { formatTime, getActualPeriodText } from '@/contexts/game-state-context';
import { Card, CardContent } from '@/components/ui/card';
import { PenaltiesDisplay } from '@/components/scoreboard/penalties-display';
import { User, WifiOff } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function MobileScoreboard() {
  const [gameState, setGameState] = useState<LiveGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Effect for initial fetch and SSE subscription
  useEffect(() => {
    let eventSource: EventSource;

    const connect = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/game-state');
        if (!response.ok) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        const data: LiveGameState | null = await response.json();
        setGameState(data);
      } catch (e) {
        console.error("Failed to fetch initial game state:", e);
        setError("No se pudo obtener el estado inicial del servidor.");
      } finally {
        setIsLoading(false);
      }

      eventSource = new EventSource('/api/game-state/events');

      eventSource.onopen = () => {
        setError(null);
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data: LiveGameState = JSON.parse(event.data);
          setGameState(data);
        } catch (e) {
          console.error("Failed to parse game state from server event:", e);
          setError("Datos del servidor corruptos.");
        }
      };

      eventSource.onerror = () => {
        console.error("EventSource failed.");
        setError("No se pudo conectar con el servidor.");
        setIsConnected(false);
      };
    };

    connect();

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // Effect for client-side visual timer tick for main clock and penalties
  useEffect(() => {
    if (!gameState || !gameState.clock.isClockRunning) {
      return;
    }

    const timerId = setInterval(() => {
      setGameState(prevState => {
        if (!prevState || !prevState.clock.isClockRunning || prevState.clock.currentTime <= 0) {
          return prevState;
        }

        const newTime = prevState.clock.currentTime - 100;
        
        const updatePenaltyTime = (penalty: Penalty): Penalty => {
          if (penalty._status === 'running' && penalty.expirationTime !== undefined) {
             const newExpirationTime = penalty.expirationTime - 100;
             return { ...penalty, expirationTime: Math.max(prevState.clock._liveAbsoluteElapsedTimeCs, newExpirationTime) };
          }
          return penalty;
        };

        return {
          ...prevState,
          clock: {
            ...prevState.clock,
            currentTime: Math.max(0, newTime),
            _liveAbsoluteElapsedTimeCs: prevState.clock._liveAbsoluteElapsedTimeCs + 100,
          },
          penalties: {
            home: prevState.penalties.home.map(updatePenaltyTime),
            away: prevState.penalties.away.map(updatePenaltyTime),
          },
        };
      });
    }, 1000); // Update every second

    return () => clearInterval(timerId);
  }, [gameState?.clock.isClockRunning, gameState?.clock.currentTime]);
  
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen p-4 gap-4 bg-background items-center justify-center">
        <LoadingSpinner className="h-12 w-12 text-primary" />
        <p className="text-muted-foreground mt-4">Obteniendo datos del partido...</p>
      </div>
    );
  }

  if (error && !isConnected && !gameState) {
    return (
      <div className="flex flex-col h-screen p-4 gap-4 bg-background text-destructive items-center justify-center text-center">
        <WifiOff className="h-16 w-16" />
        <h1 className="text-2xl font-bold">Error de Conexión</h1>
        <p className="text-destructive-foreground/80">{error}</p>
        <p className="text-xs text-muted-foreground mt-4">Intentando reconectar...</p>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="flex flex-col h-screen p-4 gap-4 bg-background items-center justify-center text-center">
        <WifiOff className="h-16 w-16 text-primary" />
        <h1 className="text-2xl font-bold">No hay partido en curso</h1>
        <p className="text-muted-foreground/80">Esperando que inicie un partido. La página se actualizará automáticamente.</p>
        {error && <p className="text-destructive mt-2">{error}</p>}
      </div>
    );
  }

  const playersPerTeam = gameState.playersPerTeamOnIce || 5;
  const activeHomePenaltiesCount = gameState.penalties.home.filter(p => p._status === 'running').length;
  const playersOnIceForHome = Math.max(0, playersPerTeam - activeHomePenaltiesCount);

  const activeAwayPenaltiesCount = gameState.penalties.away.filter(p => p._status === 'running').length;
  const playersOnIceForAway = Math.max(0, playersPerTeam - activeAwayPenaltiesCount);

  return (
    <div className="flex flex-col h-screen p-2 sm:p-4 gap-4 bg-background text-foreground">
      <Card className="bg-card shadow-lg">
        <CardContent className="p-4">
          <div className="text-center mb-4">
            <div className="font-bold font-headline tabular-nums tracking-tighter text-6xl text-accent">
              {formatTime(gameState.clock.currentTime, { showTenths: gameState.clock.currentTime < 6000, includeMinutesForTenths: false, rounding: 'down' })}
            </div>
            <div className="mt-1 font-semibold text-primary-foreground uppercase tracking-wider text-2xl">
              {getActualPeriodText(gameState.clock.currentPeriod, gameState.clock.periodDisplayOverride, gameState.numberOfRegularPeriods || 2)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div className="text-center">
              <div className="flex justify-center items-center gap-1 mb-1 h-5">
                {playersOnIceForHome > 0 && Array(playersOnIceForHome).fill(null).map((_, index) => (
                  <User key={`home-player-${index}`} className="h-5 w-5 text-primary-foreground/80" />
                ))}
              </div>
              <div className="text-xl font-bold uppercase truncate" title={gameState.homeTeamName}>{gameState.homeTeamName}</div>
              <div className="text-sm text-muted-foreground">(Local)</div>
              <div className="text-6xl font-bold text-accent">{gameState.score.home}</div>
            </div>
            <div className="text-center">
              <div className="flex justify-center items-center gap-1 mb-1 h-5">
                 {playersOnIceForAway > 0 && Array(playersOnIceForAway).fill(null).map((_, index) => (
                  <User key={`away-player-${index}`} className="h-5 w-5 text-primary-foreground/80" />
                ))}
              </div>
              <div className="text-xl font-bold uppercase truncate" title={gameState.awayTeamName}>{gameState.awayTeamName}</div>
              <div className="text-sm text-muted-foreground">(Visitante)</div>
              <div className="text-6xl font-bold text-accent">{gameState.score.away}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex-grow grid grid-cols-1 gap-4 overflow-y-auto pb-4">
         <PenaltiesDisplay teamDisplayType="Local" teamName={gameState.homeTeamName} penalties={gameState.penalties.home} mode="mobile" clock={gameState.clock} />
         <PenaltiesDisplay teamDisplayType="Visitante" teamName={gameState.awayTeamName} penalties={gameState.penalties.away} mode="mobile" clock={gameState.clock} />
      </div>
    </div>
  );
}
