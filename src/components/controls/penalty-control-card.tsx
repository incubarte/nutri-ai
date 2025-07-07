

"use client";

import React, { useState, useMemo, useRef } from 'react';
import { useGameState, formatTime, getPeriodText } from '@/contexts/game-state-context';
import type { Penalty, Team, PlayerData } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Trash2, UserPlus, Hourglass, ChevronsUpDown, Check, Info, Goal, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PenaltyLogDialog } from '../scoreboard/penalty-log-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from '@/components/ui/checkbox';
import { getActualPeriodText } from '@/contexts/game-state-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


interface PenaltyControlCardProps {
  team: Team;
  teamName: string;
}

const PenaltyItem = ({ penalty, team, isEditing, onEditStart, onEditConfirm, onEditCancel, isDeleteSelectionMode, isSelectedForDeletion, onToggleSelection, onDragStart, onDragEnter, onDragLeave, onDragOver, onDrop, onEndForGoal }: {
    penalty: Penalty;
    team: Team;
    isEditing: boolean;
    onEditStart: (penaltyId: string, currentTime: string) => void;
    onEditConfirm: (penaltyId: string, newTimeValue: string) => void;
    onEditCancel: () => void;
    isDeleteSelectionMode: boolean;
    isSelectedForDeletion: boolean;
    onToggleSelection: (penaltyId: string) => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, penaltyId: string) => void;
    onDragEnter: (e: React.DragEvent<HTMLDivElement>, penaltyId: string) => void;
    onDragLeave: () => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>, targetPenaltyId: string) => void;
    onEndForGoal: (penalty: Penalty) => void;
}) => {
    const { state } = useGameState();
    const [editTimeValue, setEditTimeValue] = useState('');
    const { clock } = state;

    const teamSubName = team === 'home' ? state.homeTeamSubName : state.awayTeamSubName;
    const matchedTeam = useMemo(() => {
      return state.teams.find(t =>
          t.name === state[`${team}TeamName`] &&
          (t.subName || undefined) === (teamSubName || undefined) &&
          t.category === state.selectedMatchCategory
      );
    }, [state.teams, state, team, teamSubName]);
    
    const matchedPlayerForPenaltyDisplay = matchedTeam?.players.find(
      pData => pData.number === penalty.playerNumber || (penalty.playerNumber === "S/N" && !pData.number)
    );
    const displayPenaltyNumber = penalty.playerNumber || 'S/N';
    
    const remainingTimeCs = (penalty._status === 'running' && penalty.expirationTime !== undefined)
      ? Math.max(0, state.clock.currentTime - penalty.expirationTime)
      : penalty.initialDuration * 100;
    
    const expirationInfo = React.useMemo(() => {
        if (penalty.expirationTime === undefined || penalty.expirationPeriod === undefined) return null;
        
        let periodText, timeText;
        const { periodDisplayOverride, currentPeriod } = clock;
        const { numberOfRegularPeriods, defaultPeriodDuration, defaultOTPeriodDuration } = state;

        if (periodDisplayOverride === 'Break' || periodDisplayOverride === 'Pre-OT Break') {
            const nextPeriodNumber = currentPeriod + 1;
            if (penalty.expirationPeriod <= currentPeriod) {
                periodText = getPeriodText(nextPeriodNumber, numberOfRegularPeriods);
                const nextPeriodDuration = nextPeriodNumber > numberOfRegularPeriods ? defaultOTPeriodDuration : defaultPeriodDuration;
                const expirationTimeInNextPeriod = nextPeriodDuration - penalty.expirationTime;
                timeText = formatTime(expirationTimeInNextPeriod);
            } else {
                periodText = getPeriodText(penalty.expirationPeriod, numberOfRegularPeriods);
                const periodDurationForCalc = penalty.expirationPeriod > numberOfRegularPeriods ? defaultOTPeriodDuration : defaultPeriodDuration;
                timeText = formatTime(periodDurationForCalc - penalty.expirationTime);
            }
        } else {
            periodText = getPeriodText(penalty.expirationPeriod, numberOfRegularPeriods);
            timeText = formatTime(penalty.expirationTime);
        }
        
        if (!periodText || !timeText) return null;
        return `Expira en ${periodText} a los ${timeText}`;

    }, [penalty, clock, state]);

    const isWaitingSlot = penalty._status === 'pending_player' || penalty._status === 'pending_concurrent';
    const isPendingPuck = penalty._status === 'pending_puck';
    const statusText = isPendingPuck ? 'Esperando Puck' : (isWaitingSlot ? 'Esperando Slot' : null);
    const isEndingSoon = penalty._status === 'running' && remainingTimeCs > 0 && remainingTimeCs < 1000;

    return (
        <Card
            draggable={!isEditing && !isDeleteSelectionMode}
            onDragStart={(e) => onDragStart(e, penalty.id)}
            onDragEnter={(e) => onDragEnter(e, penalty.id)}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, penalty.id)}
            onClick={() => isDeleteSelectionMode && onToggleSelection(penalty.id)}
            className={cn(
                "p-3 bg-muted/30 transition-all border",
                !isEditing && !isDeleteSelectionMode && "cursor-move",
                isDeleteSelectionMode && "cursor-pointer",
                isSelectedForDeletion && "ring-2 ring-destructive border-destructive bg-destructive/10",
                isWaitingSlot && "opacity-60 bg-muted/10",
                isPendingPuck && "opacity-40 bg-yellow-500/5 border-yellow-500/30",
                isEndingSoon && "animate-flashing-border border-2"
            )}
        >
            <div className="flex justify-between items-center w-full gap-2">
                <div className="flex items-center gap-3">
                    {isDeleteSelectionMode && (
                        <Checkbox
                            checked={isSelectedForDeletion}
                            onCheckedChange={() => onToggleSelection(penalty.id)}
                            aria-label={`Seleccionar penalidad del jugador ${penalty.playerNumber}`}
                            className="mr-2"
                        />
                    )}
                    <div className="flex-1 min-w-0">
                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <p className="font-semibold text-card-foreground truncate">
                                        Jugador {displayPenaltyNumber}
                                        {state.enablePlayerSelectionForPenalties && state.showAliasInControlsPenaltyList && matchedPlayerForPenaltyDisplay && matchedPlayerForPenaltyDisplay.name && (
                                            <span className="ml-1 text-xs text-muted-foreground font-normal">
                                                - {matchedPlayerForPenaltyDisplay.name}
                                            </span>
                                        )}
                                    </p>
                                </TooltipTrigger>
                                {expirationInfo && penalty._status === 'running' && (
                                    <TooltipContent><p>{expirationInfo}</p></TooltipContent>
                                )}
                            </Tooltip>
                        </TooltipProvider>
                        <p className="text-xs text-muted-foreground">
                            Total: {formatTime(penalty.initialDuration * 100)}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {isEditing ? (
                        <Input
                            type="text"
                            value={editTimeValue}
                            onChange={(e) => setEditTimeValue(e.target.value)}
                            onBlur={() => onEditConfirm(penalty.id, editTimeValue)}
                            onKeyDown={(e) => { if (e.key === 'Enter') onEditConfirm(penalty.id, editTimeValue); if (e.key === 'Escape') onEditCancel(); }}
                            className="w-20 h-8 text-center font-mono"
                            autoFocus
                            placeholder="MM:SS"
                        />
                    ) : (
                        <div
                            className="w-20 h-8 flex items-center justify-center font-mono text-lg cursor-pointer rounded-md hover:bg-white/10"
                            onClick={(e) => {
                                if (isDeleteSelectionMode) return;
                                e.stopPropagation();
                                onEditStart(penalty.id, formatTime(remainingTimeCs));
                                setEditTimeValue(formatTime(remainingTimeCs));
                            }}
                        >
                            {formatTime(remainingTimeCs)}
                        </div>
                    )}
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); onEndForGoal(penalty); }}
                        aria-label="Finalizar por gol"
                        disabled={isDeleteSelectionMode}
                    >
                        <Goal className="h-4 w-4 text-green-500" />
                    </Button>
                </div>
            </div>
            {statusText && (
                <div className={cn("text-xs italic mt-1 flex items-center", isPendingPuck ? "text-yellow-600 dark:text-yellow-400" : "text-muted-foreground")}>
                    <Hourglass className="h-3 w-3 mr-1" />
                    {statusText}
                </div>
            )}
        </Card>
    );
};


export function PenaltyControlCard({ team, teamName }: PenaltyControlCardProps) {
  const { state, dispatch } = useGameState();
  const [playerNumberForPenalty, setPlayerNumberForPenalty] = useState('');
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
  const [penaltyDurationSeconds, setPenaltyDurationSeconds] = useState('120');
  const { toast } = useToast();

  const [draggedPenaltyId, setDraggedPenaltyId] = useState<string | null>(null);
  const [dragOverPenaltyId, setDragOverPenaltyId] = useState<string | null>(null);

  const [isPlayerPopoverOpen, setIsPlayerPopoverOpen] = useState(false);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const justSelectedPlayerRef = useRef(false);
  const [isLogOpen, setIsLogOpen] = useState(false);

  // New state for editing penalty time
  const [editingPenaltyId, setEditingPenaltyId] = useState<string | null>(null);
  
  const [penaltyForGoalConfirmation, setPenaltyForGoalConfirmation] = useState<Penalty | null>(null);
  const [isDeleteSelectionMode, setIsDeleteSelectionMode] = useState(false);
  const [selectedPenaltyIds, setSelectedPenaltyIds] = useState<string[]>([]);
  const [isMassDeleteConfirmOpen, setIsMassDeleteConfirmOpen] = useState(false);


  const penalties = state.penalties[team];
  const teamSubName = team === 'home' ? state.homeTeamSubName : state.awayTeamSubName;

  const matchedTeam = useMemo(() => {
    return state.teams.find(t =>
        t.name === teamName &&
        (t.subName || undefined) === (teamSubName || undefined) &&
        t.category === state.selectedMatchCategory
    );
  }, [state.teams, teamName, teamSubName, state.selectedMatchCategory]);
  
  const teamHasPlayers = useMemo(() => {
      if (!state.enablePlayerSelectionForPenalties) return false;
      return matchedTeam && matchedTeam.players.length > 0;
  }, [matchedTeam, state.enablePlayerSelectionForPenalties]);

  const filteredPlayers = useMemo(() => {
    if (!matchedTeam || !teamHasPlayers) return [];
    let playersToFilter = matchedTeam.players.filter(p => p.number && p.number.trim() !== '');
    playersToFilter.sort((a, b) => {
      const numA = parseInt(a.number, 10);
      const numB = parseInt(b.number, 10);
      if (isNaN(numA) || isNaN(numB)) {
        return a.number.localeCompare(b.number);
      }
      return numA - numB;
    });
    
    const searchTermLower = playerSearchTerm.toLowerCase();
    if (!searchTermLower.trim()) return playersToFilter;

    return playersToFilter.filter(
      (player: PlayerData) =>
        (player.number.toLowerCase().includes(searchTermLower)) ||
        (state.showAliasInPenaltyPlayerSelector && player.name.toLowerCase().includes(searchTermLower))
    );
  }, [matchedTeam, teamHasPlayers, playerSearchTerm, state.showAliasInPenaltyPlayerSelector]);

  const handleAddPenalty = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPlayerNumberForPenalty = playerNumberForPenalty.trim();

    if (!trimmedPlayerNumberForPenalty || !penaltyDurationSeconds) {
      toast({ title: "Error", description: "Número de jugador para la penalidad y duración son requeridos.", variant: "destructive" });
      return;
    }
    if (!/^\d+$/.test(trimmedPlayerNumberForPenalty) && !/^\d+[A-Za-z]*$/.test(trimmedPlayerNumberForPenalty)) {
       toast({ title: "Error", description: "El número de jugador para la penalidad debe ser numérico o un número seguido de letras (ej. 1, 23, 15A).", variant: "destructive" });
       return;
    }

    const durationSec = parseInt(penaltyDurationSeconds, 10);
    dispatch({
      type: 'ADD_PENALTY',
      payload: {
        team,
        penalty: { playerNumber: trimmedPlayerNumberForPenalty.toUpperCase(), initialDuration: durationSec },
      },
    });
    toast({ title: "Penalidad Agregada", description: `Jugador ${trimmedPlayerNumberForPenalty.toUpperCase()}${selectedPlayerName ? ` (${selectedPlayerName})` : ''} de ${teamName} recibió una penalidad de ${formatTime(durationSec * 100)}.` });
    
    setPlayerNumberForPenalty('');
    setSelectedPlayerName(null);
    setPlayerSearchTerm('');
  };
  
  const handleSetPenaltyTime = (penaltyId: string, newTimeValue: string) => {
    const parts = newTimeValue.split(':');
    let minutes = 0;
    let seconds = 0;

    if (parts.length === 2) {
      minutes = parseInt(parts[0], 10);
      seconds = parseInt(parts[1], 10);
    } else if (parts.length === 1) {
      seconds = parseInt(parts[0], 10);
    }

    if (isNaN(minutes) || isNaN(seconds)) {
      toast({ title: "Tiempo Inválido", description: "Por favor, usa el formato MM:SS o solo segundos.", variant: "destructive" });
      setEditingPenaltyId(null);
      return;
    }

    const totalSeconds = (minutes * 60) + seconds;

    dispatch({
      type: 'SET_PENALTY_TIME',
      payload: { team, penaltyId, time: totalSeconds }
    });

    toast({ title: "Tiempo de Penalidad Establecido", description: `Tiempo actualizado a ${formatTime(totalSeconds * 100)}.` });
    
    setEditingPenaltyId(null);
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, penaltyId: string) => {
    if (isDeleteSelectionMode) {
      e.preventDefault();
      return;
    }
    setDraggedPenaltyId(penaltyId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", penaltyId);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, penaltyId: string) => {
    if (isDeleteSelectionMode) return;
    e.preventDefault();
    setDragOverPenaltyId(penaltyId);
  };

  const handleDragLeave = () => {
    if (isDeleteSelectionMode) return;
    setDragOverPenaltyId(null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (isDeleteSelectionMode) return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetPenaltyId: string) => {
    if (isDeleteSelectionMode) return;
    e.preventDefault();
    if (draggedPenaltyId && draggedPenaltyId !== targetPenaltyId) {
      const currentTeamPenalties = state.penalties[team];
      const startIndex = currentTeamPenalties.findIndex(p => p.id === draggedPenaltyId);
      const endIndex = currentTeamPenalties.findIndex(p => p.id === targetPenaltyId);

      if (startIndex !== -1 && endIndex !== -1) {
        dispatch({
          type: 'REORDER_PENALTIES',
          payload: { team, startIndex, endIndex },
        });
        toast({ title: "Penalidades Reordenadas", description: `Orden de penalidades para ${teamName} actualizado.` });
      }
    }
    setDraggedPenaltyId(null);
    setDragOverPenaltyId(null);
  };

  const handleDragEnd = () => {
    setDraggedPenaltyId(null);
    setDragOverPenaltyId(null);
  };
  
  const handleConfirmGoal = () => {
    if (!penaltyForGoalConfirmation) return;

    dispatch({ type: 'END_PENALTY_FOR_GOAL', payload: { team, penaltyId: penaltyForGoalConfirmation.id } });
    toast({ title: "Penalidad Finalizada por Gol", description: `La penalidad para el jugador #${penaltyForGoalConfirmation.playerNumber} se finalizó.` });

    setPenaltyForGoalConfirmation(null);
  };
  
  const handleToggleSelectionMode = () => {
    setIsDeleteSelectionMode(!isDeleteSelectionMode);
    setSelectedPenaltyIds([]); // Clear selection when toggling mode
  };
  
  const handleTogglePenaltySelection = (penaltyId: string) => {
    setSelectedPenaltyIds(prev =>
      prev.includes(penaltyId)
        ? prev.filter(id => id !== penaltyId)
        : [...prev, penaltyId]
    );
  };

  const handleConfirmMassDelete = () => {
    if (selectedPenaltyIds.length === 0) return;
    
    selectedPenaltyIds.forEach(penaltyId => {
      dispatch({ type: 'REMOVE_PENALTY', payload: { team, penaltyId } });
    });

    toast({
      title: "Penalidades Eliminadas",
      description: `${selectedPenaltyIds.length} penalidad(es) eliminada(s).`,
      variant: "destructive"
    });

    setIsMassDeleteConfirmOpen(false);
    setIsDeleteSelectionMode(false);
    setSelectedPenaltyIds([]);
  };

  const renderPlayerNumberInput = () => {
    if (teamHasPlayers && matchedTeam) { 
      return (
        <Popover
            open={isPlayerPopoverOpen}
            onOpenChange={(isOpen) => {
                setIsPlayerPopoverOpen(isOpen);
                if (isOpen) {
                    setPlayerSearchTerm(''); 
                }
                justSelectedPlayerRef.current = false; 
            }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={isPlayerPopoverOpen}
              className="w-full justify-between"
            >
              {playerNumberForPenalty || selectedPlayerName
                ? (
                  <span className="truncate flex items-baseline">
                    <span className="text-xs text-muted-foreground mr-0.5">#</span>
                    <span className="font-semibold">{playerNumberForPenalty || 'S/N'}</span>
                    {(state.showAliasInPenaltyPlayerSelector && selectedPlayerName) && (
                      <span className="text-xs text-muted-foreground ml-1 truncate"> - {selectedPlayerName}</span>
                    )}
                  </span>
                )
                : <span className="truncate">Nº Jugador <span className="text-foreground/70"> / Seleccionar...</span></span>
              }
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Buscar Nº o Nombre..."
                value={playerSearchTerm}
                onValueChange={setPlayerSearchTerm}
                autoComplete="off"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const trimmedSearch = playerSearchTerm.trim().toUpperCase();
                        if (filteredPlayers.length > 0) {
                            const playerToSelect = filteredPlayers[0];
                            setPlayerNumberForPenalty(playerToSelect.number);
                            setSelectedPlayerName(playerToSelect.name);
                        } else if (trimmedSearch && (/^\d+$/.test(trimmedSearch) || /^\d+[A-Za-z]*$/.test(trimmedSearch))) {
                           setPlayerNumberForPenalty(trimmedSearch);
                           setSelectedPlayerName(null);
                        }
                        justSelectedPlayerRef.current = true;
                        setIsPlayerPopoverOpen(false);
                    }
                }}
              />
              <CommandList>
                <CommandEmpty>
                  No se encontró jugador.
                  {playerSearchTerm.trim() && (/^\d+$/.test(playerSearchTerm.trim()) || /^\d+[A-Za-z]*$/.test(playerSearchTerm.trim())) && (
                     <p className="text-xs text-muted-foreground p-2">Enter para usar: #{playerSearchTerm.trim().toUpperCase()}</p>
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {filteredPlayers.map((player: PlayerData) => (
                    <CommandItem
                      key={player.id}
                      value={`${player.number} - ${state.showAliasInPenaltyPlayerSelector ? player.name : ''}`}
                      onSelect={() => {
                        setPlayerNumberForPenalty(player.number);
                        setSelectedPlayerName(player.name);
                        justSelectedPlayerRef.current = true;
                        setIsPlayerPopoverOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          (playerNumberForPenalty === player.number && selectedPlayerName === player.name)
                           ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span className="text-xs text-muted-foreground mr-0.5">#</span>
                      <span className="font-semibold text-sm mr-1">{player.number}</span>
                      {state.showAliasInPenaltyPlayerSelector && player.name && (
                         <span className="text-xs text-muted-foreground truncate">{player.name}</span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    }
    return (
      <Input
        id={`${team}-playerNumberForPenalty`}
        value={playerNumberForPenalty}
        onChange={(e) => {
            setPlayerNumberForPenalty(e.target.value.toUpperCase());
            setSelectedPlayerName(null);
        }}
        placeholder="ej., 99 o 15A"
        required
        autoComplete="off"
      />
    );
  };

  return (
    <>
    <Card className="bg-card shadow-md">
       <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl text-primary-foreground">{`Penalidades ${teamName}${teamSubName ? ` (${teamSubName})` : ''}`}</CardTitle>
          <div className="flex items-center gap-2">
            {!isDeleteSelectionMode && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={handleToggleSelectionMode}
                disabled={penalties.length === 0}
                aria-label="Seleccionar penalidades para eliminar"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary-foreground"
              onClick={() => setIsLogOpen(true)}
              aria-label="Ver registro de penalidades"
            >
              <Info className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
      {!isDeleteSelectionMode && (
        <form onSubmit={handleAddPenalty} className="space-y-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <div className="sm:col-span-1">
              <Label htmlFor={`${team}-playerNumberForPenalty`}>Jugador # (Penalidad)</Label>
              {renderPlayerNumberInput()}
            </div>
            <div className="sm:col-span-1">
              <Label htmlFor={`${team}-penaltyDuration`}>Duración (segundos)</Label>
              <Select value={penaltyDurationSeconds} onValueChange={setPenaltyDurationSeconds}>
                <SelectTrigger id={`${team}-penaltyDuration`}>
                  <SelectValue placeholder="Seleccionar duración" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">0:04 (Prueba)</SelectItem>
                  <SelectItem value="120">2:00 (Menor)</SelectItem>
                  <SelectItem value="240">4:00 (Doble Menor)</SelectItem>
                  <SelectItem value="300">5:00 (Mayor)</SelectItem>
                  <SelectItem value="600">10:00 (Mala Conducta)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full sm:w-auto sm:self-end" aria-label={`Agregar penalidad para ${teamName}`}>
              <UserPlus className="mr-2 h-4 w-4" /> Agregar
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        <Label>
          {isDeleteSelectionMode
            ? `Selecciona penalidades para eliminar (${selectedPenaltyIds.length} seleccionada/s)`
            : `Penalidades Activas (${penalties.length})`}
        </Label>
        {penalties.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin penalidades activas.</p>
        ) : (
          <div
            className="max-h-60 overflow-y-auto space-y-2 pr-2"
          >
            {penalties.map((p) => (
                <PenaltyItem
                    key={p.id}
                    penalty={p}
                    team={team}
                    isEditing={editingPenaltyId === p.id}
                    onEditStart={(id, time) => { setEditingPenaltyId(id); }}
                    onEditConfirm={handleSetPenaltyTime}
                    onEditCancel={() => setEditingPenaltyId(null)}
                    isDeleteSelectionMode={isDeleteSelectionMode}
                    isSelectedForDeletion={selectedPenaltyIds.includes(p.id)}
                    onToggleSelection={handleTogglePenaltySelection}
                    onDragStart={handleDragStart}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onEndForGoal={setPenaltyForGoalConfirmation}
                />
            ))}
          </div>
        )}
      </div>
      {isDeleteSelectionMode && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleToggleSelectionMode}>
            <X className="mr-2 h-4 w-4" /> Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={selectedPenaltyIds.length === 0}
            onClick={() => setIsMassDeleteConfirmOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Eliminar Seleccionadas ({selectedPenaltyIds.length})
          </Button>
        </div>
      )}
      </CardContent>
    </Card>
      {isLogOpen && (
        <PenaltyLogDialog 
          isOpen={isLogOpen}
          onOpenChange={setIsLogOpen}
          team={team}
          teamName={teamName}
        />
      )}
      {penaltyForGoalConfirmation && (
            <AlertDialog open={!!penaltyForGoalConfirmation} onOpenChange={() => setPenaltyForGoalConfirmation(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar Penalidad Finalizada por Gol</AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Estás seguro de que quieres finalizar la penalidad del jugador #{penaltyForGoalConfirmation.playerNumber} por un gol en contra? Esto la eliminará de la lista activa.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPenaltyForGoalConfirmation(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmGoal}>
                          Confirmar Gol en PK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
      {isMassDeleteConfirmOpen && (
        <AlertDialog open={isMassDeleteConfirmOpen} onOpenChange={setIsMassDeleteConfirmOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Eliminación Múltiple</AlertDialogTitle>
                    <AlertDialogDescription>
                        ¿Estás seguro de que quieres eliminar las {selectedPenaltyIds.length} penalidades seleccionadas? Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsMassDeleteConfirmOpen(false)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleConfirmMassDelete} className="bg-destructive hover:bg-destructive/90">
                        Eliminar Penalidades
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
