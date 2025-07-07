

"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGameState, formatTime, getActualPeriodText, getPeriodText, centisecondsToDisplayMinutes, getCategoryNameById, type TeamData } from '@/contexts/game-state-context';
import type { Team, PlayerData } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Minus, Play, Pause, ChevronLeft, ChevronRight, ChevronsRight, User, ListFilter, Search, ClipboardList, ChevronsUpDown, Check, TimerOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { EditTeamPlayersDialog } from './edit-team-players-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


type EditingSegment = 'minutes' | 'seconds' | 'tenths';

interface MiniScoreboardProps {
  onScoreClick: (team: Team) => void;
}

export function MiniScoreboard({ onScoreClick }: MiniScoreboardProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();

  const [pendingConfirmation, setPendingConfirmation] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const MAX_TOTAL_GAME_PERIODS = state.numberOfRegularPeriods + state.numberOfOvertimePeriods;

  const [editingSegment, setEditingSegment] = useState<EditingSegment | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  const [localHomeTeamName, setLocalHomeTeamName] = useState(state.homeTeamName);
  const [localHomeTeamSubName, setLocalHomeTeamSubName] = useState(state.homeTeamSubName);
  const [localAwayTeamName, setLocalAwayTeamName] = useState(state.awayTeamName);
  const [localAwayTeamSubName, setLocalAwayTeamSubName] = useState(state.awayTeamSubName);


  const [isHomeTeamSearchOpen, setIsHomeTeamSearchOpen] = useState(false);
  const [isAwayTeamSearchOpen, setIsAwayTeamSearchOpen] = useState(false);
  const [homeTeamSearchTerm, setHomeTeamSearchTerm] = useState('');
  const [awayTeamSearchTerm, setAwayTeamSearchTerm] = useState('');

  const [isHomePlayersDialogOpen, setIsHomePlayersDialogOpen] = useState(false);
  const [isAwayPlayersDialogOpen, setIsAwayPlayersDialogOpen] = useState(false);
  const [isTimeoutConfirmOpen, setIsTimeoutConfirmOpen] = useState(false);
  
  const [liveAbsoluteTime, setLiveAbsoluteTime] = useState(state.clock.absoluteElapsedTimeCs);

  useEffect(() => {
    // Only run the live timer if the clock is running AND it's a game period
    if (state.clock.isClockRunning && state.clock.clockStartTimeMs && state.clock.periodDisplayOverride === null) {
      const interval = setInterval(() => {
        const elapsedSinceStart = Date.now() - (state.clock.clockStartTimeMs || 0);
        setLiveAbsoluteTime(state.clock.absoluteElapsedTimeCs + Math.floor(elapsedSinceStart / 10));
      }, 200);
      return () => clearInterval(interval);
    } else {
      // Otherwise, just display the last saved absolute time
      setLiveAbsoluteTime(state.clock.absoluteElapsedTimeCs);
    }
  }, [state.clock.isClockRunning, state.clock.absoluteElapsedTimeCs, state.clock.clockStartTimeMs, state.clock.periodDisplayOverride]);

  
  useEffect(() => {
    setLocalHomeTeamName(state.homeTeamName);
    setLocalHomeTeamSubName(state.homeTeamSubName);
  }, [state.homeTeamName, state.homeTeamSubName]);

  useEffect(() => {
    setLocalAwayTeamName(state.awayTeamName);
    setLocalAwayTeamSubName(state.awayTeamSubName);
  }, [state.awayTeamName, state.awayTeamSubName]);


  const getTimeParts = useCallback((timeCs: number) => {
    const safeTimeCs = Math.max(0, timeCs);
    const totalSecondsOnly = Math.floor(safeTimeCs / 100);
    const minutes = Math.floor(totalSecondsOnly / 60);
    const seconds = totalSecondsOnly % 60;
    const tenths = Math.floor((safeTimeCs % 100) / 10);
    return { minutes, seconds, tenths };
  }, []);

  const timeParts = getTimeParts(state.clock.currentTime);

  useEffect(() => {
    if (editingSegment && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSegment]);

  const handleTimeAdjust = (deltaSeconds: number) => {
    if (state.clock.periodDisplayOverride === "End of Game") return;
    dispatch({ type: 'ADJUST_TIME', payload: deltaSeconds * 100 });
    toast({
      title: "Reloj Ajustado",
      description: `Tiempo ajustado en ${deltaSeconds > 0 ? '+' : ''}${deltaSeconds} segundo${Math.abs(deltaSeconds) === 1 ? '' : 's'}.`
    });
  };

  const handleToggleClock = () => {
    if (state.clock.periodDisplayOverride === "End of Game") return;
    setEditingSegment(null);
    const isFirstGameAction = state.clock.currentPeriod === 0 &&
                              state.clock.periodDisplayOverride === 'Warm-up' &&
                              state.clock.currentTime === state.defaultWarmUpDuration;
    const hasDefaultTeamNames = (state.homeTeamName.trim().toUpperCase() === 'LOCAL' || state.homeTeamName.trim() === '') ||
                                (state.awayTeamName.trim().toUpperCase() === 'VISITANTE' || state.awayTeamName.trim() === '');

    const toggleAction = () => {
      dispatch({ type: 'TOGGLE_CLOCK' });
    };

    if (!state.clock.isClockRunning && isFirstGameAction && hasDefaultTeamNames && state.enableTeamSelectionInMiniScoreboard) {
      checkAndConfirm(
        true,
        "Nombres de Equipo por Defecto",
        "Uno o ambos equipos aún tienen los nombres predeterminados ('Local', 'Visitante') o están vacíos. ¿Deseas iniciar la entrada en calor de todas formas o prefieres actualizar los nombres primero?",
        toggleAction
      );
    } else {
      toggleAction();
    }
  };

  const executeConfirmedAction = (actionFn: () => void) => {
    actionFn();
    setPendingConfirmation(null);
  };

  const cancelConfirmation = () => {
    setPendingConfirmation(null);
  };

  const checkAndConfirm = (
    condition: boolean,
    title: string,
    description: string,
    action: () => void
  ) => {
    if (condition) {
      setPendingConfirmation({ title, description, onConfirm: action });
    } else {
      action();
    }
  };

  const handlePreviousPeriod = () => {
    setEditingSegment(null);

    const actionToGoToLastPeriod = () => {
      const lastGamePeriod = MAX_TOTAL_GAME_PERIODS;
      if (lastGamePeriod >= 1) {
        dispatch({ type: 'SET_PERIOD', payload: lastGamePeriod });
      } else {
        dispatch({ type: 'SET_PERIOD', payload: 0 });
      }
      if (lastGamePeriod >= 1) {
        toast({
          title: "Regreso al Último Período",
          description: `Se ha vuelto a ${getPeriodText(lastGamePeriod, state.numberOfRegularPeriods)}. El reloj está pausado.`,
        });
      } else {
        toast({
          title: "Regreso a Entrada en Calor",
          description: `Se ha vuelto a la Entrada en Calor. El reloj está pausado (a menos que autoStartWarmUp esté activo).`,
        });
      }
    };

    if (state.clock.periodDisplayOverride === "End of Game") {
      actionToGoToLastPeriod();
      return;
    }

    if (state.clock.periodDisplayOverride === "Time Out") {
      toast({ title: "Time Out Activo", description: "Finaliza el Time Out para cambiar de período.", variant: "destructive" });
      return;
    }

    if (state.clock.periodDisplayOverride === "Break" || state.clock.periodDisplayOverride === "Pre-OT Break") {
      const actionToConfirm = () => {
        dispatch({ type: 'SET_PERIOD', payload: state.clock.currentPeriod });
        toast({ title: "Período Restaurado", description: `Retornando a ${getPeriodText(state.clock.currentPeriod, state.numberOfRegularPeriods)}. Reloj reiniciado y pausado.` });
      };

      const currentBreakDurationCs = state.clock.periodDisplayOverride === "Break" ? state.defaultBreakDuration : state.defaultPreOTBreakDuration;
      const shouldConfirm = state.clock.currentTime > 0 && state.clock.currentTime < currentBreakDurationCs;

      checkAndConfirm(
        shouldConfirm,
        "Confirmar Acción",
        `El descanso no ha finalizado. ¿Estás seguro de que quieres retornar a ${getPeriodText(state.clock.currentPeriod, state.numberOfRegularPeriods)}?`,
        actionToConfirm
      );
    } else {
      if (state.clock.currentPeriod === 1) {
        const actionToConfirm = () => {
          dispatch({ type: 'SET_PERIOD', payload: 0 });
          toast({ title: "Entrada en Calor Reiniciada", description: `Reloj de Entrada en Calor (${centisecondsToDisplayMinutes(state.defaultWarmUpDuration)} min) ${state.autoStartWarmUp ? 'corriendo.' : 'pausado.'}` });
        };
        const shouldConfirm = state.clock.currentTime > 0 && state.clock.currentTime < state.defaultPeriodDuration;
        checkAndConfirm(
          shouldConfirm,
          "Confirmar Acción",
          "El reloj del 1er período ha corrido. ¿Estás seguro de que quieres volver a la Entrada en Calor (reiniciará su tiempo)?",
          actionToConfirm
        );
      } else if (state.clock.currentPeriod > 1) {
        const actionToConfirm = () => {
          const periodBeforeIntendedBreak = state.clock.currentPeriod -1;
          dispatch({ type: 'START_BREAK_AFTER_PREVIOUS_PERIOD' });
          const isPreOT = periodBeforeIntendedBreak >= state.numberOfRegularPeriods;
          const breakType = isPreOT ? "Pre-OT Break" : "Break";
          const durationCs = isPreOT ? state.defaultPreOTBreakDuration : state.defaultBreakDuration;
          const autoStart = isPreOT ? state.autoStartPreOTBreaks : state.autoStartBreaks;
          toast({
              title: `${breakType} Iniciado`,
              description: `${breakType} iniciado después de ${getPeriodText(periodBeforeIntendedBreak, state.numberOfRegularPeriods)} (${centisecondsToDisplayMinutes(durationCs)} min). Reloj ${autoStart ? 'corriendo' : 'pausado'}.`
          });
        };

        const isCurrentPeriodOT = state.clock.currentPeriod > state.numberOfRegularPeriods;
        const currentPeriodExpectedDurationCs = isCurrentPeriodOT ? state.defaultOTPeriodDuration : state.defaultPeriodDuration;
        const shouldConfirm = state.clock.currentTime > 0 && state.clock.currentTime < currentPeriodExpectedDurationCs;
        checkAndConfirm(
          shouldConfirm,
          "Confirmar Acción",
          "El reloj del período actual ha corrido. ¿Estás seguro de que quieres iniciar el descanso del período anterior?",
          actionToConfirm
        );
      } else {
        toast({ title: "Inicio del Juego", description: "No se puede retroceder más allá de la Entrada en Calor.", variant: "destructive" });
      }
    }
  };

  const handleNextAction = () => {
    setEditingSegment(null);
    if (state.clock.periodDisplayOverride === "End of Game") return;

    if (state.clock.periodDisplayOverride === "Time Out") {
      if (state.clock.currentTime <= 0) {
        dispatch({ type: 'END_TIMEOUT' });
        toast({ title: "Time Out Finalizado", description: "Juego reanudado al estado anterior." });
      } else {
        toast({ title: "Time Out en Curso", description: "El tiempo de Time Out aún no ha finalizado." });
      }
      return;
    }

    if (state.clock.currentPeriod === 0 && state.clock.periodDisplayOverride === "Warm-up") {
      const actionToConfirm = () => {
        dispatch({ type: 'SET_PERIOD', payload: 1 });
        toast({ title: "1er Período Iniciado", description: `Reloj de 1er Período (${centisecondsToDisplayMinutes(state.defaultPeriodDuration)} min) pausado.` });
      };
      const shouldConfirm = state.clock.currentTime > 0 && state.clock.currentTime < state.defaultWarmUpDuration;
        checkAndConfirm(
          shouldConfirm,
          "Confirmar Acción",
          "La Entrada en Calor no ha finalizado. ¿Estás seguro de que quieres iniciar el 1er Período?",
          actionToConfirm
        );
    } else if (state.clock.periodDisplayOverride === "Break" || state.clock.periodDisplayOverride === "Pre-OT Break") {
      const nextNumericPeriod = state.clock.currentPeriod + 1;
      if (nextNumericPeriod <= MAX_TOTAL_GAME_PERIODS) {
        const actionToConfirm = () => {
            dispatch({ type: 'SET_PERIOD', payload: nextNumericPeriod });
            toast({ title: "Período Cambiado", description: `Período establecido a ${getPeriodText(nextNumericPeriod, state.numberOfRegularPeriods)}. Reloj reiniciado y pausado.` });
        };

        const currentBreakDurationCs = state.clock.periodDisplayOverride === "Break" ? state.defaultBreakDuration : state.defaultPreOTBreakDuration;
        const shouldConfirm = state.clock.currentTime > 0 && state.clock.currentTime < currentBreakDurationCs;

        checkAndConfirm(
            shouldConfirm,
            "Confirmar Acción",
            `El descanso no ha finalizado. ¿Estás seguro de que quieres iniciar ${getPeriodText(nextNumericPeriod, state.numberOfRegularPeriods)}?`,
            actionToConfirm
        );
      } else { 
        const actionToConfirm = () => {
          dispatch({ type: 'MANUAL_END_GAME' });
          toast({ title: "Partido Finalizado", description: "El juego ha terminado." });
        };
        const currentBreakDurationCs = state.clock.periodDisplayOverride === "Break" ? state.defaultBreakDuration : state.defaultPreOTBreakDuration;
        const shouldConfirm = state.clock.currentTime > 0 && state.clock.currentTime < currentBreakDurationCs;
         checkAndConfirm(
            shouldConfirm,
            "Confirmar Finalizar Partido",
            `El descanso no ha finalizado. ¿Estás seguro de que quieres finalizar el partido?`,
            actionToConfirm
        );
      }
    } else if (state.clock.periodDisplayOverride === null) { // Active game period
      if (state.clock.currentPeriod >= MAX_TOTAL_GAME_PERIODS && MAX_TOTAL_GAME_PERIODS > 0) { 
        const actionToConfirm = () => {
          dispatch({ type: 'MANUAL_END_GAME' });
          toast({ title: "Partido Finalizado", description: "El juego ha terminado." });
        };
        const shouldConfirm = state.clock.currentTime > 0;
        checkAndConfirm(
          shouldConfirm,
          "Confirmar Finalizar Partido",
          "El reloj del último período aún tiene tiempo. ¿Estás seguro de que quieres finalizar el partido ahora?",
          actionToConfirm
        );
      } else if (MAX_TOTAL_GAME_PERIODS === 0 && state.clock.currentPeriod === 0) { 
         const actionToConfirm = () => {
          dispatch({ type: 'MANUAL_END_GAME' });
          toast({ title: "Partido Finalizado", description: "El juego ha terminado." });
        };
        const shouldConfirm = state.clock.currentTime > 0;
         checkAndConfirm(
          shouldConfirm,
          "Confirmar Finalizar Partido",
          "La entrada en calor aún tiene tiempo. ¿Estás seguro de que quieres finalizar el partido ahora?",
          actionToConfirm
        );
      } else { 
        const actionToConfirm = () => {
          const isPreOT = state.clock.currentPeriod >= state.numberOfRegularPeriods;
          if (isPreOT) {
            dispatch({ type: 'START_PRE_OT_BREAK' });
          } else {
            dispatch({ type: 'START_BREAK' });
          }
          const breakType = isPreOT ? "Pre-OT Break" : "Break";
          const durationCs = isPreOT ? state.defaultPreOTBreakDuration : state.defaultBreakDuration;
          const autoStart = isPreOT ? state.autoStartPreOTBreaks : state.autoStartBreaks;
          toast({
              title: `${breakType} Iniciado`,
              description: `${breakType} iniciado después de ${getPeriodText(state.clock.currentPeriod, state.numberOfRegularPeriods)} (${centisecondsToDisplayMinutes(durationCs)} min). Reloj ${autoStart ? 'corriendo' : 'pausado'}.`
          });
        };
        const isCurrentPeriodOT = state.clock.currentPeriod > state.numberOfRegularPeriods;
        const currentPeriodExpectedDurationCs = isCurrentPeriodOT ? state.defaultOTPeriodDuration : state.defaultPeriodDuration;
        const shouldConfirm = state.clock.currentTime > 0 && state.clock.currentTime < currentPeriodExpectedDurationCs;

        checkAndConfirm(
          shouldConfirm,
          "Confirmar Acción",
          "El reloj del período actual ha corrido. ¿Estás seguro de que quieres iniciar el descanso?",
          actionToConfirm
        );
      }
    }
  };

  const isPreviousPeriodDisabled = (state.clock.currentPeriod === 0 && state.clock.periodDisplayOverride === "Warm-up") || state.clock.periodDisplayOverride === "Time Out";

  let isNextActionDisabled = false;
  if (state.clock.periodDisplayOverride === "Time Out" && state.clock.currentTime > 0) {
      isNextActionDisabled = true;
  } else if (state.clock.periodDisplayOverride === "End of Game") {
      isNextActionDisabled = true;
  }


  const showNextActionButton = state.clock.currentTime <= 0 && !state.clock.isClockRunning && state.clock.periodDisplayOverride !== "End of Game";


  let nextActionButtonText = "Siguiente";
  if (state.clock.periodDisplayOverride === "Time Out" && state.clock.currentTime <=0) {
    nextActionButtonText = "Finalizar Time Out";
  } else if (state.clock.currentPeriod === 0 && state.clock.periodDisplayOverride === "Warm-up" && state.clock.currentTime <= 0) {
    if (MAX_TOTAL_GAME_PERIODS > 0) {
        nextActionButtonText = "Iniciar 1er Período";
    } else {
        nextActionButtonText = "Finalizar Partido"; 
    }
  } else if (state.clock.periodDisplayOverride === null && state.clock.currentTime <= 0 && state.clock.currentPeriod < MAX_TOTAL_GAME_PERIODS) {
    nextActionButtonText = "Iniciar Descanso";
  } else if (state.clock.periodDisplayOverride === null && state.clock.currentTime <= 0 && ((state.clock.currentPeriod >= MAX_TOTAL_GAME_PERIODS && MAX_TOTAL_GAME_PERIODS > 0) || (MAX_TOTAL_GAME_PERIODS === 0 && state.clock.currentPeriod === 0))) {
     nextActionButtonText = "Finalizar Partido";
  } else if ((state.clock.periodDisplayOverride === "Break" || state.clock.periodDisplayOverride === "Pre-OT Break") && state.clock.currentTime <= 0) {
     if (state.clock.currentPeriod + 1 <= MAX_TOTAL_GAME_PERIODS) {
        nextActionButtonText = `Iniciar ${getPeriodText(state.clock.currentPeriod + 1, state.numberOfRegularPeriods)}`;
     } else {
        nextActionButtonText = "Finalizar Partido";
     }
  }


  const isMainClockLastMinute = state.clock.currentTime < 6000 && state.clock.currentTime >= 0 &&
                               (state.clock.periodDisplayOverride !== null || state.clock.currentPeriod >= 0) &&
                               state.clock.periodDisplayOverride !== "End of Game";

  const preTimeoutTimeCs = state.clock.preTimeoutState?.time;
  const isPreTimeoutLastMinute = typeof preTimeoutTimeCs === 'number' && preTimeoutTimeCs < 6000 && preTimeoutTimeCs >= 0;

  const handleSegmentClick = (segment: EditingSegment) => {
    if (state.clock.isClockRunning || state.clock.periodDisplayOverride === "End of Game") return;
    setEditingSegment(segment);
    switch (segment) {
      case 'minutes': setEditValue(String(timeParts.minutes).padStart(2, '0')); break;
      case 'seconds': setEditValue(String(timeParts.seconds).padStart(2, '0')); break;
      case 'tenths': setEditValue(String(timeParts.tenths)); break;
    }
  };

  const handleTimeEditConfirm = () => {
    if (!editingSegment || state.clock.periodDisplayOverride === "End of Game") return;

    const { minutes: currentMins, seconds: currentSecs, tenths: currentTenths } = timeParts;
    let newTimeCs = state.clock.currentTime;
    const value = parseInt(editValue, 10);

    if (isNaN(value)) {
      setEditingSegment(null);
      toast({ title: "Valor Inválido", description: "Por favor, ingresa un número.", variant: "destructive" });
      return;
    }

    switch (editingSegment) {
      case 'minutes':
        const newMinutes = Math.max(0, Math.min(value, 99));
        newTimeCs = (newMinutes * 60 * 100) + (currentSecs * 100) + (currentTenths * 10);
        break;
      case 'seconds':
        const newSeconds = Math.max(0, Math.min(value, 59));
        newTimeCs = (currentMins * 60 * 100) + (newSeconds * 100) + (currentTenths * 10);
        break;
      case 'tenths':
        if (isMainClockLastMinute) {
          const newTenthsVal = Math.max(0, Math.min(value, 9));
          newTimeCs = (currentMins * 60 * 100) + (currentSecs * 100) + (newTenthsVal * 10);
        }
        break;
    }
    newTimeCs = Math.max(0, newTimeCs);

    const payloadMinutes = Math.floor(newTimeCs / 6000);
    const payloadSeconds = Math.floor((newTimeCs % 6000) / 100);
    
    dispatch({ type: 'SET_TIME', payload: { minutes: payloadMinutes, seconds: payloadSeconds } });
    
    toast({
      title: "Reloj Actualizado",
      description: `Tiempo establecido a ${formatTime(newTimeCs, { showTenths: newTimeCs < 6000, includeMinutesForTenths: true })}`,
    });
    setEditingSegment(null);
  };

  const commonInputClass = cn(
    "bg-transparent border-0 p-0 text-center h-auto tabular-nums focus:ring-0 focus:outline-none focus:border-b focus:border-primary",
    "text-5xl font-bold",
    isMainClockLastMinute ? "text-orange-500" : "text-accent"
  );
  const commonSpanClass = cn(!(state.clock.isClockRunning || state.clock.periodDisplayOverride === "End of Game") && "cursor-pointer hover:underline");

  const activeHomePenaltiesCount = state.penalties.home.filter(p => p._status === 'running').length;
  const playersOnIceForHome = Math.max(0, state.playersPerTeamOnIce - activeHomePenaltiesCount);

  const activeAwayPenaltiesCount = state.penalties.away.filter(p => p._status === 'running').length;
  const playersOnIceForAway = Math.max(0, state.playersPerTeamOnIce - activeAwayPenaltiesCount);

  const handleMatchCategoryChange = (categoryId: string) => {
    dispatch({ type: 'SET_SELECTED_MATCH_CATEGORY', payload: categoryId });
    toast({ title: "Categoría del Partido Actualizada" });
  };

  const filteredTeamsForSearch = (searchTerm: string) => {
    if (!state.teams) return [];
    return state.teams.filter(team =>
      team.category === state.selectedMatchCategory &&
      (
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (team.subName && team.subName.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    ).sort((a,b) => a.name.localeCompare(b.name));
  };

  const filteredHomeTeams = useMemo(() => filteredTeamsForSearch(homeTeamSearchTerm), [homeTeamSearchTerm, state.teams, state.selectedMatchCategory]);
  const filteredAwayTeams = useMemo(() => filteredTeamsForSearch(awayTeamSearchTerm), [awayTeamSearchTerm, state.teams, state.selectedMatchCategory]);

  const handleSelectTeam = (teamType: 'home' | 'away', teamData: TeamData) => {
    if (teamType === 'home') {
      dispatch({ type: 'SET_HOME_TEAM_NAME', payload: teamData.name });
      dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: teamData.subName });
      setIsHomeTeamSearchOpen(false);
      setHomeTeamSearchTerm('');
    } else {
      dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: teamData.name });
      dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: teamData.subName });
      setIsAwayTeamSearchOpen(false);
      setAwayTeamSearchTerm('');
    }
    toast({ title: `Equipo ${teamType === 'home' ? 'Local' : 'Visitante'} Establecido`, description: `Equipo seleccionado: ${teamData.name}${teamData.subName ? ` - ${teamData.subName}` : ''}` });
  };

  const matchedHomeTeamId = useMemo(() => {
    if (!state.enableTeamSelectionInMiniScoreboard) return null;
    const matched = state.teams.find(t =>
      t.name === state.homeTeamName &&
      (t.subName || undefined) === (state.homeTeamSubName || undefined) &&
      t.category === state.selectedMatchCategory
    );
    return matched ? matched.id : null;
  }, [state.homeTeamName, state.homeTeamSubName, state.teams, state.selectedMatchCategory, state.enableTeamSelectionInMiniScoreboard]);

  const matchedAwayTeamId = useMemo(() => {
     if (!state.enableTeamSelectionInMiniScoreboard) return null;
    const matched = state.teams.find(t =>
      t.name === state.awayTeamName &&
      (t.subName || undefined) === (state.awayTeamSubName || undefined) &&
      t.category === state.selectedMatchCategory
    );
    return matched ? matched.id : null;
  }, [state.awayTeamName, state.awayTeamSubName, state.teams, state.selectedMatchCategory, state.enableTeamSelectionInMiniScoreboard]);

  const showHomeSearchIcon = state.enableTeamSelectionInMiniScoreboard && state.teams.length > 0;
  const showAwaySearchIcon = state.enableTeamSelectionInMiniScoreboard && state.teams.length > 0;
  const showHomePlayersIcon = state.enableTeamSelectionInMiniScoreboard;
  const showAwayPlayersIcon = state.enableTeamSelectionInMiniScoreboard;


  const handleTeamNameInputBlur = (teamType: 'home' | 'away', currentLocalName: string) => {
    if (teamType === 'home') {
      if (currentLocalName.trim() !== state.homeTeamName) { 
        dispatch({ type: 'SET_HOME_TEAM_NAME', payload: currentLocalName.trim() || 'Local' });
        dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: undefined }); 
      }
    } else {
      if (currentLocalName.trim() !== state.awayTeamName) {
        dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: currentLocalName.trim() || 'Visitante' });
        dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: undefined }); 
      }
    }
  };

  const handleTeamNameInputKeyDown = (teamType: 'home' | 'away', currentLocalName: string, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      if (teamType === 'home') {
        dispatch({ type: 'SET_HOME_TEAM_NAME', payload: currentLocalName.trim() || 'Local' });
        dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: undefined });
      } else {
        dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: currentLocalName.trim() || 'Visitante' });
        dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: undefined });
      }
      (event.target as HTMLInputElement).blur();
    }
  };

  const handlePrepareStartTimeout = () => {
    setIsTimeoutConfirmOpen(true);
  };

  const performStartTimeout = () => {
    dispatch({ type: 'START_TIMEOUT' }); 
    const autoStart = state.autoStartTimeouts;
    const timeoutDurationSec = state.defaultTimeoutDuration / 100;
    toast({ 
        title: "Time Out Iniciado", 
        description: `Time Out de ${timeoutDurationSec} segundos. Reloj ${autoStart ? 'corriendo' : 'pausado'}.`
    });
    setIsTimeoutConfirmOpen(false);
  };

  const isTimeOutButtonDisabled = 
    state.clock.periodDisplayOverride === "Break" ||
    state.clock.periodDisplayOverride === "Pre-OT Break" ||
    state.clock.periodDisplayOverride === "Time Out";

  const timeoutDurationInSeconds = state.defaultTimeoutDuration / 100;
  const autoStartBehavior = state.autoStartTimeouts ? "se iniciará automáticamente" : "deberá iniciarse manualmente";


  return (
    <div className="relative">
      <div className="absolute top-0 left-0 p-2 sm:p-3 md:p-4 z-20">
        <div className="flex items-center gap-2">
          {state.availableCategories.length > 0 ? (
              <Select value={state.selectedMatchCategory} onValueChange={handleMatchCategoryChange}>
                  <SelectTrigger className="w-auto min-w-[120px] max-w-[200px] h-8 text-xs bg-card/80 border-border/50 backdrop-blur-sm">
                      <div className="flex items-center gap-1.5 truncate">
                          <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
                          <SelectValue placeholder="Categoría" />
                      </div>
                  </SelectTrigger>
                  <SelectContent>
                      {state.availableCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id} className="text-xs">
                              {cat.name}
                          </SelectItem>
                      ))}
                  </SelectContent>
              </Select>
          ) : (
              <div className="flex items-center gap-1.5 h-8 px-3 text-xs bg-card/80 border-border/50 rounded-md text-muted-foreground">
                  <ListFilter className="h-3.5 w-3.5" />
                  <span>Sin categorías</span>
              </div>
          )}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xs text-muted-foreground font-mono bg-card/80 p-1 rounded-md border border-border/50 cursor-help">
                  Abs: {formatTime(liveAbsoluteTime)} ({formatTime(state.clock.absoluteElapsedTimeCs)})
                </div>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <p className="font-bold mb-2">Variables del Reloj (Debug)</p>
                <div className="grid grid-cols-[auto_1fr] gap-x-2">
                  <strong>currentTime:</strong>
                  <span>{state.clock.currentTime}cs ({formatTime(state.clock.currentTime)})</span>
                  <strong>isClockRunning:</strong>
                  <span>{String(state.clock.isClockRunning)}</span>
                  <strong>absoluteElapsedTimeCs:</strong>
                  <span>{state.clock.absoluteElapsedTimeCs}cs ({formatTime(state.clock.absoluteElapsedTimeCs)})</span>
                  <strong>clockStartTimeMs:</strong>
                  <span>{state.clock.clockStartTimeMs ? new Date(state.clock.clockStartTimeMs).toLocaleTimeString() : 'null'}</span>
                  <strong>remainingTimeAtStartCs:</strong>
                  <span>{state.clock.remainingTimeAtStartCs !== null ? `${state.clock.remainingTimeAtStartCs}cs` : 'null'}</span>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="absolute top-0 right-0 p-2 sm:p-3 md:p-4 z-20">
        <Button
          onClick={handlePrepareStartTimeout}
          variant="outline"
          className="h-8 text-xs bg-card/80 border-border/50 backdrop-blur-sm"
          disabled={isTimeOutButtonDisabled}
          aria-label="Iniciar Time Out"
        >
          <TimerOff className="mr-1.5 h-3.5 w-3.5" />
          Time Out
        </Button>
      </div>

      <Card className="mb-8 bg-card shadow-lg pt-12 sm:pt-10 md:pt-12">
        <CardContent className="flex flex-col sm:flex-row justify-around items-center text-center gap-4 sm:gap-8 py-6">
          {/* Home Team Section */}
          <div className="flex-1 w-full sm:w-auto">
            <div className="flex justify-center items-center gap-1 mb-1 h-5 md:h-6 lg:h-7">
              {playersOnIceForHome > 0 && Array(playersOnIceForHome).fill(null).map((_, index) => (
                <User key={`home-player-${index}`} className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 text-primary-foreground/80" />
              ))}
              {playersOnIceForHome === 0 && state.playersPerTeamOnIce > 0 && (
                <span className="text-xs text-destructive animate-pulse">0 JUGADORES</span>
              )}
            </div>
             <div className="relative w-full max-w-xs mx-auto my-1">
                 <div className="flex items-center justify-center">
                    {showHomeSearchIcon && (
                        <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0")} asChild>
                             <Popover open={isHomeTeamSearchOpen} onOpenChange={setIsHomeTeamSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                </PopoverTrigger>
                                <PopoverContent className="w-[240px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Buscar equipo..." value={homeTeamSearchTerm} onValueChange={setHomeTeamSearchTerm} />
                                        <CommandList>
                                            <CommandEmpty>No se encontraron equipos.</CommandEmpty>
                                            <CommandGroup>
                                                {filteredHomeTeams.map((team) => (
                                                    <CommandItem
                                                        key={team.id}
                                                        value={`${team.name}${team.subName ? ` - ${team.subName}` : ''}`}
                                                        onSelect={() => handleSelectTeam('home', team)}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", localHomeTeamName === team.name && (localHomeTeamSubName || undefined) === (team.subName || undefined) ? "opacity-100" : "opacity-0")} />
                                                        <span className="truncate">{team.name}{team.subName ? <span className="text-xs text-muted-foreground"> - {team.subName}</span> : ''}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </Button>
                    )}
                    <Input
                        id="homeTeamNameInput"
                        value={localHomeTeamName}
                        onChange={(e) => setLocalHomeTeamName(e.target.value)}
                        onBlur={() => handleTeamNameInputBlur('home', localHomeTeamName)}
                        onKeyDown={(e) => handleTeamNameInputKeyDown('home', localHomeTeamName, e)}
                        placeholder="Nombre Local"
                        className={cn(
                            "h-8 text-sm uppercase w-auto text-center",
                             showHomeSearchIcon && "ml-1", 
                             showHomePlayersIcon && "mr-1"
                        )}
                        aria-label="Nombre del equipo local"
                        autoComplete="off"
                    />
                    {showHomePlayersIcon && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-7 w-7 shrink-0")}
                            onClick={() => setIsHomePlayersDialogOpen(true)}
                            disabled={!matchedHomeTeamId}
                            aria-label="Editar jugadores del equipo local"
                        >
                            <ClipboardList className={cn("h-4 w-4", matchedHomeTeamId ? "text-muted-foreground" : "text-muted-foreground/50 opacity-60")} />
                        </Button>
                    )}
                </div>
                 {matchedHomeTeamId && localHomeTeamSubName && (
                    <p className="text-xs text-muted-foreground text-center mt-0.5 truncate">
                        ({localHomeTeamSubName})
                    </p>
                )}
            </div>
            <p className="text-sm text-muted-foreground text-center my-1">({state.enableTeamSelectionInMiniScoreboard && state.teams.length > 0 && state.homeTeamName.trim() ? 'Local' : state.homeTeamName.trim() || 'Local'})</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Button variant="link" className="p-0 h-auto text-4xl font-bold text-accent w-24 text-center tabular-nums hover:no-underline hover:text-accent/80" onClick={() => onScoreClick('home')}>
                {state.score.home}
              </Button>
            </div>
            {matchedHomeTeamId && isHomePlayersDialogOpen && (
              <EditTeamPlayersDialog
                isOpen={isHomePlayersDialogOpen}
                onOpenChange={setIsHomePlayersDialogOpen}
                teamId={matchedHomeTeamId}
                teamName={localHomeTeamName}
                teamType="home"
              />
            )}
          </div>

          {/* Clock & Period Section */}
          <div className="flex-1 space-y-2 text-center">
            {showNextActionButton ? (
              <Button
                onClick={handleNextAction}
                className="w-full max-w-[200px] mx-auto mb-2"
                variant="default"
                aria-label={nextActionButtonText}
                disabled={isNextActionDisabled}
              >
                <ChevronsRight className="mr-2 h-5 w-5" /> {nextActionButtonText}
              </Button>
            ) : (
              <Button
                onClick={handleToggleClock}
                className="w-full max-w-[180px] mx-auto mb-2"
                variant={state.clock.isClockRunning ? "destructive" : "default"}
                aria-label={state.clock.isClockRunning ? "Pausar Reloj" : "Iniciar Reloj"}
                disabled={(state.clock.currentTime <= 0 && !state.clock.isClockRunning && state.clock.periodDisplayOverride !== "Time Out") || state.clock.periodDisplayOverride === "End of Game"}
              >
                {state.clock.isClockRunning ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                {state.clock.isClockRunning ? 'Pausar' : 'Iniciar'} Reloj
              </Button>
            )}

            {state.clock.periodDisplayOverride === "End of Game" ? (
                <div className={cn(
                    "text-3xl font-bold tabular-nums flex items-baseline justify-center gap-0.5 text-accent py-4"
                  )}>
                    FIN
                </div>
            ) : (
                <div className={cn("text-5xl font-bold tabular-nums flex items-baseline justify-center gap-0.5", isMainClockLastMinute ? "text-orange-500" : "text-accent")}>
                  {!(state.clock.isClockRunning || state.clock.periodDisplayOverride === "End of Game") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-accent self-center mr-1"
                      onClick={() => handleTimeAdjust(-1)}
                      aria-label="Restar 1 segundo al reloj"
                      disabled={state.clock.currentTime <=0 || editingSegment !== null || state.clock.periodDisplayOverride === "End of Game"}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  )}

                  {editingSegment === 'minutes' ? (
                    <Input
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      value={editValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val) && val.length <= 2) setEditValue(val);
                      }}
                      onBlur={handleTimeEditConfirm}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTimeEditConfirm();
                        if (e.key === 'Escape') setEditingSegment(null);
                      }}
                      className={cn(commonInputClass, "w-[60px] px-0")}
                      maxLength={2}
                      autoComplete="off"
                    />
                  ) : (
                    <span onClick={() => handleSegmentClick('minutes')} className={commonSpanClass}>
                      {String(timeParts.minutes).padStart(2, '0')}
                    </span>
                  )}
                  <span className={isMainClockLastMinute ? "text-orange-500" : "text-accent"}>:</span>
                  {editingSegment === 'seconds' ? (
                    <Input
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      value={editValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^\d*$/.test(val) && val.length <= 2) setEditValue(val);
                      }}
                      onBlur={handleTimeEditConfirm}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleTimeEditConfirm();
                        if (e.key === 'Escape') setEditingSegment(null);
                      }}
                      className={cn(commonInputClass, "w-[60px] px-0")}
                      maxLength={2}
                      autoComplete="off"
                    />
                  ) : (
                    <span onClick={() => handleSegmentClick('seconds')} className={commonSpanClass}>
                      {String(timeParts.seconds).padStart(2, '0')}
                    </span>
                  )}
                  {isMainClockLastMinute && (
                    <>
                      <span className="text-orange-500">.</span>
                      {editingSegment === 'tenths' ? (
                        <Input
                          ref={inputRef}
                          type="text"
                          inputMode="numeric"
                          value={editValue}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^\d*$/.test(val) && val.length <= 1) setEditValue(val);
                          }}
                          onBlur={handleTimeEditConfirm}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleTimeEditConfirm();
                            if (e.key === 'Escape') setEditingSegment(null);
                          }}
                          className={cn(commonInputClass, "w-[30px] text-orange-500 px-0")}
                          maxLength={1}
                          autoComplete="off"
                        />
                      ) : (
                        <span onClick={() => handleSegmentClick('tenths')} className={cn(commonSpanClass, "text-orange-500")}>
                          {String(timeParts.tenths)}
                        </span>
                      )}
                    </>
                  )}
                  {!(state.clock.isClockRunning || state.clock.periodDisplayOverride === "End of Game") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-accent self-center ml-1"
                      onClick={() => handleTimeAdjust(1)}
                      aria-label="Sumar 1 segundo al reloj"
                      disabled={editingSegment !== null || state.clock.periodDisplayOverride === "End of Game"}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  )}
                </div>
            )}
            

            <div className="relative mt-1 flex items-center justify-center gap-2">
               <Button
                onClick={handlePreviousPeriod}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary-foreground"
                aria-label="Período Anterior o Descanso"
                disabled={isPreviousPeriodDisabled || editingSegment !== null}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <p className="text-lg text-primary-foreground uppercase w-36 truncate text-center">
                {getActualPeriodText(state.clock.currentPeriod, state.clock.periodDisplayOverride, state.numberOfRegularPeriods)}
              </p>
              <Button
                onClick={handleNextAction}
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary-foreground"
                aria-label="Siguiente Período o Descanso"
                disabled={isNextActionDisabled || editingSegment !== null}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              {!state.clock.isClockRunning && state.clock.currentTime > 0 && state.clock.periodDisplayOverride !== "End of Game" && !showNextActionButton && editingSegment === null && (
                <span className="absolute top-[-0.25rem] right-1 text-[0.6rem] font-normal text-muted-foreground normal-case px-1 rounded-sm bg-background/30">
                  Paused
                </span>
              )}
            </div>
            {state.clock.preTimeoutState && state.clock.periodDisplayOverride !== "End of Game" && (
              <div className={cn(
                  "text-xs mt-1 normal-case",
                  isPreTimeoutLastMinute ? "text-orange-500/80" : "text-muted-foreground"
                )}>
                Retornando a: {getPeriodText(state.clock.preTimeoutState.period, state.numberOfRegularPeriods)} - {formatTime(state.clock.preTimeoutState.time, { showTenths: isPreTimeoutLastMinute, includeMinutesForTenths: false })}
                {state.clock.preTimeoutState.override ? ` (${state.clock.preTimeoutState.override})` : ''}
              </div>
            )}
          </div>

          {/* Away Team Section */}
          <div className="flex-1 w-full sm:w-auto">
            <div className="flex justify-center items-center gap-1 mb-1 h-5 md:h-6 lg:h-7">
              {playersOnIceForAway > 0 && Array(playersOnIceForAway).fill(null).map((_, index) => (
                <User key={`away-player-${index}`} className="h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7 text-primary-foreground/80" />
              ))}
              {playersOnIceForAway === 0 && state.playersPerTeamOnIce > 0 && (
                <span className="text-xs text-destructive animate-pulse">0 JUGADORES</span>
              )}
            </div>
             <div className="relative w-full max-w-xs mx-auto my-1">
                <div className="flex items-center justify-center">
                    {showAwaySearchIcon && (
                        <Button variant="ghost" size="icon" className={cn("h-7 w-7 shrink-0")} asChild>
                            <Popover open={isAwayTeamSearchOpen} onOpenChange={setIsAwayTeamSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                </PopoverTrigger>
                                <PopoverContent className="w-[240px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Buscar equipo..." value={awayTeamSearchTerm} onValueChange={setAwayTeamSearchTerm} />
                                        <CommandList>
                                            <CommandEmpty>No se encontraron equipos.</CommandEmpty>
                                            <CommandGroup>
                                                {filteredAwayTeams.map((team) => (
                                                    <CommandItem
                                                        key={team.id}
                                                        value={`${team.name}${team.subName ? ` - ${team.subName}` : ''}`}
                                                        onSelect={() => handleSelectTeam('away', team)}
                                                    >
                                                        <Check className={cn("mr-2 h-4 w-4", localAwayTeamName === team.name && (localAwayTeamSubName || undefined) === (team.subName || undefined) ? "opacity-100" : "opacity-0")} />
                                                        <span className="truncate">{team.name}{team.subName ? <span className="text-xs text-muted-foreground"> - {team.subName}</span> : ''}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </Button>
                    )}
                    <Input
                        id="awayTeamNameInput"
                        value={localAwayTeamName}
                        onChange={(e) => setLocalAwayTeamName(e.target.value)}
                        onBlur={() => handleTeamNameInputBlur('away', localAwayTeamName)}
                        onKeyDown={(e) => handleTeamNameInputKeyDown('away', localAwayTeamName, e)}
                        placeholder="Nombre Visitante"
                         className={cn(
                            "h-8 text-sm uppercase w-auto text-center",
                            showAwaySearchIcon && "ml-1",
                            showAwayPlayersIcon && "mr-1"
                        )}
                        aria-label="Nombre del equipo visitante"
                        autoComplete="off"
                    />
                     {showAwayPlayersIcon && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("h-7 w-7 shrink-0")}
                            onClick={() => setIsAwayPlayersDialogOpen(true)}
                            disabled={!matchedAwayTeamId}
                            aria-label="Editar jugadores del equipo visitante"
                        >
                            <ClipboardList className={cn("h-4 w-4", matchedAwayTeamId ? "text-muted-foreground" : "text-muted-foreground/50 opacity-60")} />
                        </Button>
                    )}
                </div>
                {matchedAwayTeamId && localAwayTeamSubName && (
                    <p className="text-xs text-muted-foreground text-center mt-0.5 truncate">
                        ({localAwayTeamSubName})
                    </p>
                )}
            </div>
            <p className="text-sm text-muted-foreground text-center my-1">({state.enableTeamSelectionInMiniScoreboard && state.teams.length > 0 && state.awayTeamName.trim() ? 'Visitante' : state.awayTeamName.trim() || 'Visitante'})</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Button variant="link" className="p-0 h-auto text-4xl font-bold text-accent w-24 text-center tabular-nums hover:no-underline hover:text-accent/80" onClick={() => onScoreClick('away')}>
                {state.score.away}
              </Button>
            </div>
             {matchedAwayTeamId && isAwayPlayersDialogOpen && (
              <EditTeamPlayersDialog
                isOpen={isAwayPlayersDialogOpen}
                onOpenChange={setIsAwayPlayersDialogOpen}
                teamId={matchedAwayTeamId}
                teamName={localAwayTeamName}
                teamType="away"
              />
            )}
          </div>
        </CardContent>
      </Card>
      
      {pendingConfirmation && (
        <AlertDialog open={true} onOpenChange={(isOpen) => !isOpen && cancelConfirmation()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingConfirmation.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingConfirmation.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={cancelConfirmation}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => executeConfirmedAction(pendingConfirmation.onConfirm)}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {isTimeoutConfirmOpen && (
        <AlertDialog open={isTimeoutConfirmOpen} onOpenChange={setIsTimeoutConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Inicio de Time Out</AlertDialogTitle>
              <AlertDialogDescription>
                Esto guardará el estado actual del reloj del partido, lo pausará e iniciará un Time Out de {timeoutDurationInSeconds} segundos.
                El reloj del Time Out {autoStartBehavior}. ¿Estás seguro?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsTimeoutConfirmOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={performStartTimeout}>
                Confirmar e Iniciar Time Out
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}


