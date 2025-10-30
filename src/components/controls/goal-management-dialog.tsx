
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useGameState, getPeriodText, type Team, type GoalLog, type PlayerData, getActualPeriodText, formatTime } from "@/contexts/game-state-context";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, PlusCircle, CheckCircle, XCircle, Goal, Edit3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";


interface GoalManagementDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  team: Team | null;
}

function AddGoalForm({ team, onGoalAdded, disabled }: { team: Team, onGoalAdded: () => void, disabled: boolean }) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [scorerNumber, setScorerNumber] = useState('');
  const [assistNumber, setAssistNumber] = useState('');

  const teamData = useMemo(() => {
    if (!state.config || !state.live || !state.config.tournaments) return null;
    const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
    if (!selectedTournament || !selectedTournament.teams) return null;

    const teamName = team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;
    const teamSubName = team === 'home' ? state.live.homeTeamSubName : state.live.awayTeamSubName;
    return selectedTournament.teams.find(t => t.name === teamName && (t.subName || undefined) === (teamSubName || undefined) && t.category === state.config.selectedMatchCategory);
  }, [team, state.live, state.config]);

  const selectedPlayer = useMemo(() => teamData?.players.find(p => p.number === scorerNumber), [teamData, scorerNumber]);
  const selectedAssistPlayer = useMemo(() => teamData?.players.find(p => p.number === assistNumber), [teamData, assistNumber]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.live || !state.config) return;

    const { periodDisplayOverride } = state.live.clock;
    if (disabled || (periodDisplayOverride && periodDisplayOverride !== 'Time Out')) {
        toast({ title: "Acción no permitida", description: "No se pueden agregar goles durante el calentamiento, descansos o con el partido finalizado.", variant: "destructive" });
        return;
    }

    const trimmedScorerNumber = scorerNumber.trim();
    const trimmedAssistNumber = assistNumber.trim();

    if (!trimmedScorerNumber) {
      toast({ title: "Número del Goleador Requerido", description: "Debes ingresar el número del jugador que anotó.", variant: "destructive" });
      return;
    }
    if (!/^\d+$/.test(trimmedScorerNumber)) {
      toast({ title: "Número de Goleador Inválido", description: "El número debe ser numérico.", variant: "destructive" });
      return;
    }

    const payload: Omit<GoalLog, 'id'> = {
        team,
        timestamp: Date.now(),
        gameTime: state.live.clock.currentTime,
        periodText: getActualPeriodText(state.live.clock.currentPeriod, state.live.clock.periodDisplayOverride, state.config.numberOfRegularPeriods, state.live.shootout),
        scorer: {
          playerNumber: trimmedScorerNumber,
          playerName: selectedPlayer?.name,
        },
    };

    if (trimmedAssistNumber) {
        if (!/^\d+$/.test(trimmedAssistNumber)) {
            toast({ title: "Número de Asistencia Inválido", description: "El número de la asistencia debe ser numérico.", variant: "destructive" });
            return;
        }
        if (trimmedAssistNumber === trimmedScorerNumber) {
            toast({ title: "Jugador Duplicado", description: "El goleador y el asistente no pueden ser el mismo jugador.", variant: "destructive" });
            return;
        }
        payload.assist = {
            playerNumber: trimmedAssistNumber,
            playerName: selectedAssistPlayer?.name,
        };
    }
    
    dispatch({ type: 'ADD_GOAL', payload });

    toast({ title: "Gol Añadido", description: `Gol para el jugador #${trimmedScorerNumber} registrado.` });
    setScorerNumber('');
    setAssistNumber('');
    onGoalAdded();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Añadir Nuevo Gol</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-end gap-4">
            <div className="flex-grow w-full grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="new-scorer-number"># Gol</Label>
                    <Input
                        id="new-scorer-number"
                        value={scorerNumber}
                        onChange={(e) => { if (/^\d*$/.test(e.target.value)) setScorerNumber(e.target.value); }}
                        placeholder="Ej: 99"
                        autoComplete="off"
                        disabled={disabled}
                    />
                    {selectedPlayer && <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedPlayer.name}>Jugador: {selectedPlayer.name}</p>}
                </div>
                <div>
                    <Label htmlFor="new-assist-number"># Asistencia</Label>
                    <Input
                        id="new-assist-number"
                        value={assistNumber}
                        onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAssistNumber(e.target.value); }}
                        placeholder="(Opcional)"
                         autoComplete="off"
                         disabled={disabled}
                    />
                    {selectedAssistPlayer && <p className="text-xs text-muted-foreground mt-1 truncate" title={selectedAssistPlayer.name}>Asistente: {selectedAssistPlayer.name}</p>}
                </div>
            </div>
            <Button type="submit" className="w-full sm:w-auto mt-2 sm:mt-0" disabled={disabled}>
                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Gol
            </Button>
        </form>
      </CardContent>
    </Card>
  );
}


function EditableGoalItem({ goal }: { goal: GoalLog }) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);

  // Editing state
  const { minutes, seconds } = useMemo(() => {
    const totalSeconds = Math.floor(goal.gameTime / 100);
    return {
      minutes: Math.floor(totalSeconds / 60),
      seconds: totalSeconds % 60,
    };
  }, [goal.gameTime]);
  const [minInput, setMinInput] = useState(String(minutes).padStart(2, '0'));
  const [secInput, setSecInput] = useState(String(seconds).padStart(2, '0'));
  const [periodInput, setPeriodInput] = useState(goal.periodText);
  const [scorerNumberInput, setScorerNumberInput] = useState(goal.scorer?.playerNumber || '');
  const [assistNumberInput, setAssistNumberInput] = useState(goal.assist?.playerNumber || '');

  const periodOptions = useMemo(() => {
    if (!state.config) return [];
    const options: { value: string, label: string }[] = [];
    const totalPeriods = state.config.numberOfRegularPeriods + state.config.numberOfOvertimePeriods;
    for (let i = 1; i <= totalPeriods; i++) {
        const periodText = getPeriodText(i, state.config.numberOfRegularPeriods);
        options.push({ value: periodText, label: periodText });
    }
    return options;
  }, [state.config]);

  useEffect(() => {
    if (!isEditing) {
      const totalSeconds = Math.floor(goal.gameTime / 100);
      setMinInput(String(Math.floor(totalSeconds / 60)).padStart(2, '0'));
      setSecInput(String(totalSeconds % 60).padStart(2, '0'));
      setPeriodInput(goal.periodText);
      setScorerNumberInput(goal.scorer?.playerNumber || '');
      setAssistNumberInput(goal.assist?.playerNumber || '');
    }
  }, [isEditing, goal]);

  const teamData = useMemo(() => {
    if (!state.config || !state.live || !state.config.tournaments) return null;
    const selectedTournament = state.config.tournaments.find(t => t.id === state.config.selectedTournamentId);
    if (!selectedTournament || !selectedTournament.teams) return null;

    const teamName = goal.team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;
    const teamSubName = goal.team === 'home' ? state.live.homeTeamSubName : state.live.awayTeamSubName;
    return selectedTournament.teams.find(t => t.name === teamName && (t.subName || undefined) === (teamSubName || undefined) && t.category === state.config.selectedMatchCategory);
  }, [goal.team, state.live, state.config]);

  const handleSave = () => {
    const trimmedScorerNumber = scorerNumberInput.trim();
    if (!trimmedScorerNumber || !/^\d+$/.test(trimmedScorerNumber)) {
      toast({ title: "Número de Goleador Inválido", description: "El número del goleador es requerido y debe ser numérico.", variant: "destructive" });
      return;
    }

    const trimmedAssistNumber = assistNumberInput.trim();
    if (trimmedAssistNumber && !/^\d+$/.test(trimmedAssistNumber)) {
      toast({ title: "Número de Asistencia Inválido", description: "El número de la asistencia debe ser numérico.", variant: "destructive" });
      return;
    }
    if (trimmedScorerNumber && trimmedAssistNumber && trimmedScorerNumber === trimmedAssistNumber) {
        toast({ title: "Jugador Duplicado", description: "El goleador y el asistente no pueden ser el mismo jugador.", variant: "destructive" });
        return;
    }
    
    const mins = parseInt(minInput, 10) || 0;
    const secs = parseInt(secInput, 10) || 0;
    const newGameTime = (mins * 60 + secs) * 100;
    
    const scorerPlayer = teamData?.players.find(p => p.number === trimmedScorerNumber);

    const updates: Partial<GoalLog> = {};
    if (newGameTime !== goal.gameTime) updates.gameTime = newGameTime;
    if (periodInput !== goal.periodText) updates.periodText = periodInput;
    if (trimmedScorerNumber !== goal.scorer?.playerNumber) {
        updates.scorer = { playerNumber: trimmedScorerNumber, playerName: scorerPlayer?.name };
    }
    if (trimmedAssistNumber !== (goal.assist?.playerNumber || '') || (!trimmedAssistNumber && goal.assist)) {
        if (trimmedAssistNumber) {
            const assistPlayer = teamData?.players.find(p => p.number === trimmedAssistNumber);
            updates.assist = { playerNumber: trimmedAssistNumber, playerName: assistPlayer?.name };
        } else {
            updates.assist = undefined;
        }
    }


    if (Object.keys(updates).length > 0) {
        dispatch({ type: 'EDIT_GOAL', payload: { goalId: goal.id, updates } });
        toast({ title: "Gol Actualizado", description: "Los cambios en el gol han sido guardados." });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    dispatch({ type: 'DELETE_GOAL', payload: { goalId: goal.id } });
    toast({ title: "Gol Eliminado", description: "El gol ha sido eliminado del registro." });
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const displayTimestamp = useMemo(() => {
    const date = new Date(goal.timestamp);
    if (isNaN(date.getTime())) return { time: '--:--', date: '--/--' };
    return {
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: date.toLocaleDateString([], { day: '2-digit', month: '2-digit' }),
    }
  }, [goal.timestamp]);

  if (isEditing) {
    return (
      <Card className="bg-card/80 border-primary/50">
        <CardContent className="p-3 space-y-3">
            <div className="flex flex-col sm:flex-row items-baseline gap-x-4 gap-y-2">
                {/* Time and Period Inputs */}
                <div className="flex items-center gap-2">
                    <Input value={minInput} onChange={(e) => { if (/^\d{0,2}$/.test(e.target.value)) setMinInput(e.target.value); }} className="w-12 h-8 text-center" aria-label="Minutos del gol" />
                    <span>:</span>
                    <Input value={secInput} onChange={(e) => { if (/^\d{0,2}$/.test(e.target.value)) setSecInput(e.target.value); }} className="w-12 h-8 text-center" aria-label="Segundos del gol" />
                    <Select value={periodInput} onValueChange={setPeriodInput}>
                        <SelectTrigger className="w-24 h-8 text-center justify-center">
                            <SelectValue placeholder="Período" />
                        </SelectTrigger>
                        <SelectContent>
                            {periodOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {/* Scorer and Assist Inputs */}
                <div className="flex items-center gap-2">
                    <Label htmlFor={`scorer-${goal.id}`} className="text-sm text-muted-foreground"># Gol:</Label>
                    <Input id={`scorer-${goal.id}`} value={scorerNumberInput} onChange={(e) => { if (/^\d*$/.test(e.target.value)) setScorerNumberInput(e.target.value); }} className="w-16 h-8 text-center" />
                    <Label htmlFor={`assist-${goal.id}`} className="text-sm text-muted-foreground ml-2"># Asist:</Label>
                    <Input id={`assist-${goal.id}`} value={assistNumberInput} onChange={(e) => { if (/^\d*$/.test(e.target.value)) setAssistNumberInput(e.target.value); }} className="w-16 h-8 text-center" placeholder="Opc."/>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600" onClick={handleSave}><CheckCircle className="h-5 w-5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive/80" onClick={handleCancel}><XCircle className="h-5 w-5" /></Button>
            </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 flex-grow min-w-0">
          <div className="flex flex-col text-xs text-muted-foreground w-20 text-center">
            <span>{displayTimestamp.time}</span>
            <span className="opacity-80">{displayTimestamp.date}</span>
          </div>
          <div className="font-semibold text-card-foreground truncate">
            <p>
              Gol #{goal.scorer?.playerNumber || 'S/N'}
              {goal.assist?.playerNumber && (
                <span className="text-sm font-normal text-muted-foreground"> (Asist. #{goal.assist.playerNumber})</span>
              )}
            </p>
            <p className="text-sm text-muted-foreground font-normal">
              {formatTime(goal.gameTime)} - {goal.periodText}
            </p>
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="text-primary hover:text-primary/80 h-8 w-8" onClick={() => setIsEditing(true)}>
            <Edit3 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function GoalManagementDialog({ isOpen, onOpenChange, team }: GoalManagementDialogProps) {
  const { state } = useGameState();

  if (!state.live || !state.config) return null;

  const teamName = team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;
  
  const displayedGoals = useMemo(() => {
    if (!team || !state.live.score) return [];
    const goalsList = (team === 'home' ? state.live.score.homeGoals : state.live.score.awayGoals) || [];
    return [...goalsList].sort((a, b) => b.timestamp - a.timestamp);
  }, [state.live.score, team]);

  if (!team) return null;

  const isActionDisabled = state.live.clock.periodDisplayOverride !== null && state.live.clock.periodDisplayOverride !== 'Time Out';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-xl h-[90vh] flex flex-col"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">Gestión de Goles: {teamName}</DialogTitle>
          <DialogDescription>
            Añade nuevos goles o edita los existentes. Los cambios se guardan automáticamente.
          </DialogDescription>
        </DialogHeader>

        <AddGoalForm team={team} onGoalAdded={() => onOpenChange(false)} disabled={isActionDisabled} />

        <Separator className="my-4" />
        
        <h3 className="text-lg font-medium text-primary-foreground -mb-2">Goles Registrados ({displayedGoals.length})</h3>
        <ScrollArea className="flex-grow pr-4 -mr-4">
          <div className="py-2 space-y-3">
            {displayedGoals.length > 0 ? displayedGoals.map(goal => (
              <EditableGoalItem key={goal.id} goal={goal} />
            )) : (
              <div className="text-center py-10 text-muted-foreground">
                <Goal className="mx-auto h-12 w-12 mb-4" />
                <p>No se han registrado goles para {teamName}.</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="border-t pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

