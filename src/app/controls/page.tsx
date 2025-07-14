
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MiniScoreboard } from '@/components/controls/mini-scoreboard';
import { PenaltyControlCard } from '@/components/controls/penalty-control-card';
import { GoalManagementDialog } from '@/components/controls/goal-management-dialog';
import { GameSummaryDialog } from '@/components/controls/game-summary-dialog';
import { GoldenGoalDialog } from '@/components/controls/golden-goal-dialog';
import { GameSetupDialog } from '@/components/controls/game-setup-dialog';
import { useGameState, type Team, type GoalLog, type PenaltyLog, getCategoryNameById, formatTime } from '@/contexts/game-state-context';
import type { PlayerData, RemoteCommand } from '@/types';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, AlertTriangle, PlayCircle, FileText, Trophy, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveGameSummary } from '@/ai/flows/file-operations';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { safeUUID } from '@/lib/utils';

const CONTROLS_LOCK_KEY = 'icevision-controls-lock-id';
const CONTROLS_CHANNEL_NAME = 'icevision-controls-channel';

type PageDisplayState = 'Checking' | 'Primary' | 'Secondary';

export default function ControlsPage() {
  const { state, dispatch, isLoading } = useGameState();
  const { toast } = useToast();
  const router = useRouter();

  const [pageDisplayState, setPageDisplayState] = useState<PageDisplayState>('Checking');
  const [currentLockHolderId, setCurrentLockHolderId] = useState<string | null>(null);
  
  const [instanceId, setInstanceId] = useState<string | null>(null);
  
  const channelRef = useRef<BroadcastChannel | null>(null);
  
  const [isGoalManagementOpen, setIsGoalManagementOpen] = useState(false);
  const [editingTeamForGoals, setEditingTeamForGoals] = useState<Team | null>(null);
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [isGoldenGoalDialogOpen, setIsGoldenGoalDialogOpen] = useState(false);
  const [isGameSetupDialogOpen, setIsGameSetupDialogOpen] = useState(false);

  const prevPeriodDisplayOverrideRef = useRef<string | null>();
  const isInitialMount = useRef(true);

  // Ref to hold the latest state for use in the EventSource callback
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (isLoading || !state.live || !state.config) return;

    if (isInitialMount.current) {
        isInitialMount.current = false;
        prevPeriodDisplayOverrideRef.current = state.live.clock.periodDisplayOverride;
        return;
    }

    if (pageDisplayState !== 'Primary') {
        prevPeriodDisplayOverrideRef.current = state.live.clock.periodDisplayOverride;
        return;
    }

    if (prevPeriodDisplayOverrideRef.current !== 'End of Game' && state.live.clock.periodDisplayOverride === 'End of Game') {
        const categoryName = getCategoryNameById(state.config.selectedMatchCategory, state.config.availableCategories) || 'N/A';
        
        (async () => {
            try {
                const result = await saveGameSummary({
                    homeTeamName: state.live.homeTeamName,
                    awayTeamName: state.live.awayTeamName,
                    homeScore: state.live.score.home,
                    awayScore: state.live.score.away,
                    categoryName: categoryName,
                    gameSummary: state.live.gameSummary
                });
                if (result.success) {
                    toast({
                        title: "Resumen Guardado",
                        description: `El resumen del partido se ha guardado en el servidor.`,
                    });
                } else {
                    toast({
                        title: "Error al Guardar",
                        description: result.message,
                        variant: "destructive",
                    });
                }
            } catch (e) {
                console.error('Failed to save game summary from controls page:', e);
                toast({
                    title: "Error al Guardar Resumen",
                    description: "No se pudo guardar el resumen del partido en el servidor.",
                    variant: "destructive",
                });
            }
        })();
    }

    prevPeriodDisplayOverrideRef.current = state.live.clock.periodDisplayOverride;

  }, [state.live, state.config, isLoading, pageDisplayState, toast]);


  useEffect(() => {
    setInstanceId(safeUUID());
  }, []);

  const checkLockStatus = useCallback(() => {
    if (!instanceId) {
      return;
    }
    const lockIdFromStorage = localStorage.getItem(CONTROLS_LOCK_KEY);
    
    if (!lockIdFromStorage) {
      localStorage.setItem(CONTROLS_LOCK_KEY, instanceId);
      setCurrentLockHolderId(instanceId);
      setPageDisplayState('Primary');
      console.log(`Instance ${instanceId.slice(-6)} took lock (no prior lock). State: Primary`);
    } else if (lockIdFromStorage === instanceId) {
      setPageDisplayState('Primary');
      setCurrentLockHolderId(instanceId);
      console.log(`Instance ${instanceId.slice(-6)} confirmed lock. State: Primary`);
    } else {
      setPageDisplayState('Secondary');
      setCurrentLockHolderId(lockIdFromStorage);
      console.log(`Instance ${instanceId.slice(-6)} found lock by ${lockIdFromStorage.slice(-6)}. State: Secondary`);
    }
  }, [instanceId, setPageDisplayState, setCurrentLockHolderId]);


  useEffect(() => {
    if (!instanceId) return; 
    console.log(`ControlsPage Effect: Instance ${instanceId.slice(-6)} mounting/updating. Current state: ${pageDisplayState}`);
    
    setPageDisplayState('Checking'); 

    if (!channelRef.current) {
      channelRef.current = new BroadcastChannel(CONTROLS_CHANNEL_NAME);
      console.log(`Instance ${instanceId.slice(-6)} created BroadcastChannel.`);
    }

    const handleChannelMessage = (message: MessageEvent) => {
      if (!instanceId) return;
      console.log(`Instance ${instanceId.slice(-6)} received channel message:`, message.data);
      if (message.data?.type === 'TAKEOVER_COMMAND') {
        if (message.data.newPrimaryId !== instanceId) {
          console.log(`Instance ${instanceId.slice(-6)} received TAKEOVER by ${message.data.newPrimaryId.slice(-6)}, navigating to /`);
          router.push('/');
        } else {
          console.log(`Instance ${instanceId.slice(-6)} is the new primary from TAKEOVER_COMMAND.`);
          setPageDisplayState('Primary');
          setCurrentLockHolderId(instanceId);
        }
      } else if (message.data?.type === 'LOCK_RELEASED') {
        if (message.data.releasedBy !== instanceId) {
          console.log(`Instance ${instanceId.slice(-6)} detected LOCK_RELEASED by ${message.data.releasedBy.slice(-6)}, re-checking lock.`);
          checkLockStatus();
        }
      }
    };
    channelRef.current.onmessage = handleChannelMessage;

    const handleStorageChange = (event: StorageEvent) => {
      if (!instanceId) return;
      if (event.key === CONTROLS_LOCK_KEY) {
        console.log(`Instance ${instanceId.slice(-6)} detected storage change for ${CONTROLS_LOCK_KEY}. New value: ${event.newValue?.slice(-6)}, Old value: ${event.oldValue?.slice(-6)}`);
        checkLockStatus();
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const handleBeforeUnload = () => {
      if (!instanceId) return;
      const currentLockIdInStorage = localStorage.getItem(CONTROLS_LOCK_KEY);
      if (currentLockIdInStorage === instanceId) {
        localStorage.removeItem(CONTROLS_LOCK_KEY);
        console.log(`Instance ${instanceId.slice(-6)} released lock on beforeunload.`);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    checkLockStatus();

    return () => {
      if (!instanceId) return;
      console.log(`ControlsPage Cleanup: Instance ${instanceId.slice(-6)} unmounting. Current lock holder in storage: ${localStorage.getItem(CONTROLS_LOCK_KEY)?.slice(-6)}`);
      
      const currentLockIdInStorage = localStorage.getItem(CONTROLS_LOCK_KEY);
      if (currentLockIdInStorage === instanceId) {
        localStorage.removeItem(CONTROLS_LOCK_KEY);
        if (channelRef.current) { 
             channelRef.current.postMessage({ type: 'LOCK_RELEASED', releasedBy: instanceId });
        }
        console.log(`Instance ${instanceId.slice(-6)} released lock via useEffect cleanup.`);
      }
      
      if (channelRef.current) {
        channelRef.current.close(); 
        channelRef.current = null;
        console.log(`Instance ${instanceId.slice(-6)} closed BroadcastChannel.`);
      }
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [instanceId, checkLockStatus, router]);


  // Effect for listening to remote commands from the server
  useEffect(() => {
    if (pageDisplayState !== 'Primary') {
      return;
    }

    const eventSource = new EventSource('/api/remote-commands/events');

    eventSource.onmessage = (event) => {
      try {
        const command: RemoteCommand = JSON.parse(event.data);
        // Use the ref to get the most up-to-date state
        const { live: currentLive, config: currentConfig } = stateRef.current;
        
        if (!currentLive || !currentConfig) {
            console.warn("Received remote command but state is not ready. Ignoring.");
            return;
        }

        console.log("Remote command received:", command);
        if (command.type === 'ADD_GOAL') {
          const { team, scorerNumber, assistNumber } = command.payload;
          const teamData = currentConfig.teams.find(t => t.name === currentLive[`${team}TeamName`] && (t.subName || undefined) === (currentLive[`${team}TeamSubName`] || undefined) && t.category === currentConfig.selectedMatchCategory);
          const scorerPlayer = teamData?.players.find(p => p.number === scorerNumber);
          const assistPlayer = assistNumber ? teamData?.players.find(p => p.number === assistNumber) : undefined;
          
          const goalPayload: Omit<GoalLog, 'id'> = {
            team,
            timestamp: Date.now(),
            gameTime: currentLive.clock.currentTime,
            periodText: getActualPeriodText(currentLive.clock.currentPeriod, currentLive.clock.periodDisplayOverride, currentConfig.numberOfRegularPeriods),
            scorer: { playerNumber: scorerNumber, playerName: scorerPlayer?.name },
            assist: assistNumber ? { playerNumber: assistNumber, playerName: assistPlayer?.name } : undefined,
          };

          dispatch({ type: 'ADD_GOAL', payload: goalPayload });
          toast({ title: "Gol Añadido (Remoto)", description: `Gol para ${team === 'home' ? currentLive.homeTeamName : currentLive.awayTeamName} #${scorerNumber} registrado.` });
        } else if (command.type === 'ADD_PENALTY') {
          const { team, playerNumber, penaltyTypeId } = command.payload;
          const penaltyDef = currentConfig.penaltyTypes.find(p => p.id === penaltyTypeId);
          if (penaltyDef) {
            dispatch({
                type: 'ADD_PENALTY',
                payload: {
                  team,
                  penalty: { playerNumber, penaltyTypeId },
                },
            });
            toast({ title: "Penalidad Añadida (Remoto)", description: `Jugador #${playerNumber} de ${team === 'home' ? currentLive.homeTeamName : currentLive.awayTeamName} recibió una penalidad de ${penaltyDef.name}.` });
          }
        } else if (command.type === 'ACTIVATE_PENDING_PUCK_PENALTIES') {
            dispatch({ type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
            toast({ title: "Puck en Juego (Remoto)", description: "Se activaron las penalidades pendientes." });
        }
      } catch (e) {
        console.error("Failed to parse remote command from server event:", e);
      }
    };

    eventSource.onerror = () => {
      console.error("Remote command EventSource failed. Reconnecting...");
    };

    return () => {
      eventSource.close();
    };
  }, [pageDisplayState, dispatch, toast]);


  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (pageDisplayState !== 'Primary') {
        return;
      }

      if (event.code === 'Space' || event.key === ' ') {
        const activeElement = document.activeElement as HTMLElement;
        
        if (
          activeElement &&
          (activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable ||
            activeElement.getAttribute?.('role') === 'button')
        ) {
          return; 
        }
        
        event.preventDefault();
        dispatch({ type: 'TOGGLE_CLOCK' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch, pageDisplayState]);


  const handleTakeOver = useCallback(() => {
    if (!instanceId) {
      toast({ title: "Error", description: "No se pudo obtener el ID de la instancia. Intenta recargar.", variant: "destructive" });
      return;
    }
    console.log(`Instance ${instanceId.slice(-6)} attempting to take over.`);
    localStorage.setItem(CONTROLS_LOCK_KEY, instanceId);
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'TAKEOVER_COMMAND', newPrimaryId: instanceId });
    }
    setCurrentLockHolderId(instanceId);
    setPageDisplayState('Primary'); 
    toast({ title: "Control Adquirido", description: "Esta pestaña ahora es la principal para los controles." });
  }, [instanceId, toast, setCurrentLockHolderId, setPageDisplayState]);


  const handleResetGame = useCallback(() => {
    dispatch({ type: 'RESET_GAME_STATE' });
  }, [dispatch]);
  
  const handleActivatePendingPuckPenalties = () => {
    dispatch({ type: 'ACTIVATE_PENDING_PUCK_PENALTIES' });
  };
  
  const handleAddExtraOvertime = () => {
    dispatch({ type: 'ADD_EXTRA_OVERTIME' });
    toast({ title: "Overtime Extra Añadido", description: "Se ha añadido un período de OT y se ha iniciado un descanso." });
  };

  const hasPendingPuckPenalties = useMemo(() => {
    if (!state.live || !state.live.penalties) return false;
    return state.live.penalties.home.some(p => p._status === 'pending_puck') ||
           state.live.penalties.away.some(p => p._status === 'pending_puck');
  }, [state.live]);
  
  const isTiedAndFinished = useMemo(() => {
     if (!state.live) return false;
     return state.live.clock.periodDisplayOverride === 'End of Game' && state.live.score.home === state.live.score.away;
  }, [state.live]);

  const handleScoreClick = (team: Team) => {
    setEditingTeamForGoals(team);
    setIsGoalManagementOpen(true);
  };
  
  const isOvertime = state.live.clock.currentPeriod > state.config.numberOfRegularPeriods && state.live.clock.periodDisplayOverride === null;
  const handleFinishByGoldenGoal = () => {
    if (state.live.clock.isClockRunning) {
        dispatch({ type: 'TOGGLE_CLOCK' });
    }
    if (state.live.score.home === state.live.score.away) {
        setIsGoldenGoalDialogOpen(true);
    } else {
        dispatch({ type: 'MANUAL_END_GAME' });
        toast({ title: "Partido Finalizado", description: "El juego ha sido finalizado manualmente." });
    }
  };

  if (isLoading || !state.live || !state.config || !state.live.penalties) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <LoadingSpinner className="h-12 w-12 text-primary mb-4" />
        <p className="text-xl text-foreground">Cargando...</p>
      </div>
    );
  }

  if (pageDisplayState === 'Checking' || !instanceId) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
        <LoadingSpinner className="h-12 w-12 text-primary mb-4" />
        <p className="text-xl text-foreground">Verificando instancia de controles...</p>
        <p className="text-sm text-muted-foreground">Esto tomará un momento.</p>
        <p className="text-xs text-muted-foreground mt-2">ID de esta instancia: ...{instanceId ? instanceId.slice(-6) : 'generando...'}</p>
      </div>
    );
  }

  if (pageDisplayState === 'Secondary') {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-6 rounded-lg shadow-xl bg-card max-w-md mx-auto">
        <AlertTriangle className="h-16 w-16 text-destructive mb-6" />
        <h1 className="text-2xl font-bold text-destructive-foreground mb-3">Múltiples Pestañas de Controles</h1>
        <p className="text-lg text-card-foreground mb-4">
          Ya existe otra pestaña o instancia de Controles activa. Para evitar problemas, solo una puede estar activa.
        </p>
        <div className="space-y-3 w-full max-w-xs">
           <Button onClick={handleTakeOver} className="w-full">
            Tomar el Control Principal en esta Pestaña
          </Button>
          <Button variant="outline" onClick={() => router.push('/')} className="w-full">
            Ir al Scoreboard
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          ID de esta instancia: ...{instanceId ? instanceId.slice(-6) : 'N/A'} <br />
          ID de la instancia activa: ...{currentLockHolderId?.slice(-6) || 'Desconocido'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto space-y-8">
      <MiniScoreboard onScoreClick={handleScoreClick} />

      {hasPendingPuckPenalties && (
        <div className="my-6 flex justify-center">
          <Button
            variant="destructive"
            size="lg"
            className="px-8 py-4 text-base font-semibold h-auto" 
            onClick={handleActivatePendingPuckPenalties}
          >
            <PlayCircle className="mr-2 h-5 w-5" /> 
            ACTIVAR PENALIDADES (PUCK EN JUEGO)
          </Button>
        </div>
      )}

      {isOvertime && (
        <div className="my-6 flex justify-center">
          <Button
            size="lg"
            className="px-8 py-4 text-base font-semibold h-auto bg-amber-500 hover:bg-amber-600 text-black"
            onClick={handleFinishByGoldenGoal}
          >
            <Trophy className="mr-2 h-5 w-5" /> 
            Finalizar por Gol de Oro
          </Button>
        </div>
      )}
      
      {isTiedAndFinished && (
        <div className="my-6 flex justify-center">
          <Button
            size="lg"
            className="px-8 py-4 text-base font-semibold h-auto bg-blue-600 hover:bg-blue-700"
            onClick={handleAddExtraOvertime}
          >
            <PlusCircle className="mr-2 h-5 w-5" />
            Añadir Overtime Extra
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PenaltyControlCard team="home" teamName={state.live.homeTeamName} />
        <PenaltyControlCard team="away" teamName={state.live.awayTeamName} />
      </div>
      <div className="mt-12 pt-8 border-t border-border">
         <div className="flex flex-wrap gap-4 items-start">
            <Button variant="outline" className="flex-shrink-0" onClick={() => setIsGameSetupDialogOpen(true)}>
              <RefreshCw className="mr-2 h-4 w-4" /> Iniciar Nuevo Partido
            </Button>
            <Button variant="outline" className="flex-shrink-0" onClick={() => setIsSummaryDialogOpen(true)}>
              <FileText className="mr-2 h-4 w-4" /> Ver Resumen del Partido
            </Button>
        </div>
         <p className="text-xs text-muted-foreground mt-2">
          La acción "Iniciar Nuevo Partido" restablecerá los marcadores, el reloj, el período actual, las penalidades y el registro de eventos del partido.
          Las configuraciones de duración de períodos, descansos, timeouts y penalidades se mantendrán.
        </p>
      </div>
       <p className="text-xs text-muted-foreground mt-6 text-center">
          ID de esta instancia de Controles (Primaria): ...{instanceId ? instanceId.slice(-6) : 'N/A'}
      </p>

      {isGoalManagementOpen && (
        <GoalManagementDialog 
            isOpen={isGoalManagementOpen} 
            onOpenChange={(isOpen) => {
              if (isOpen) {
                setIsGoalManagementOpen(true);
              } else {
                setTimeout(() => setIsGoalManagementOpen(false), 150);
              }
            }}
            team={editingTeamForGoals}
        />
      )}

      {isGoldenGoalDialogOpen && (
          <GoldenGoalDialog
              isOpen={isGoldenGoalDialogOpen}
              onOpenChange={(isOpen) => {
                if (isOpen) {
                  setIsGoldenGoalDialogOpen(true);
                } else {
                  setTimeout(() => setIsGoldenGoalDialogOpen(false), 150);
                }
              }}
          />
      )}

      {isSummaryDialogOpen && (
        <GameSummaryDialog 
          isOpen={isSummaryDialogOpen}
          onOpenChange={(isOpen) => {
            if (isOpen) {
              setIsSummaryDialogOpen(true);
            } else {
              setTimeout(() => setIsSummaryDialogOpen(false), 150);
            }
          }}
        />
      )}

      {isGameSetupDialogOpen && (
        <GameSetupDialog 
            isOpen={isGameSetupDialogOpen}
            onOpenChange={(isOpen) => {
              if (isOpen) {
                setIsGameSetupDialogOpen(true);
              } else {
                setTimeout(() => setIsGameSetupDialogOpen(false), 150);
              }
            }}
            onGameReset={handleResetGame}
        />
      )}

    </div>
  );
}
