
"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useGameState, getCategoryNameById, formatTime } from "@/contexts/game-state-context";
import type { TeamData, CategoryData } from "@/types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from "@/lib/utils";

interface GameSetupDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onGameReset: () => void;
  onLoadMatchConfig: (categoryId: string, homeTeamId: string, awayTeamId: string) => void;
}

const TeamSelector = ({
    label,
    teams,
    selectedTeamId,
    onSelectTeam,
    disabledTeamId,
    disabled
}: {
    label: string;
    teams: TeamData[];
    selectedTeamId: string;
    onSelectTeam: (teamId: string) => void;
    disabledTeamId?: string;
    disabled?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    const selectedTeam = teams.find(t => t.id === selectedTeamId);

    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between h-11"
                        disabled={disabled || teams.length === 0}
                    >
                        <span className="truncate">
                          {selectedTeam
                            ? `${selectedTeam.name}${selectedTeam.subName ? ` (${selectedTeam.subName})` : ''}`
                            : (teams.length > 0 ? "Seleccionar equipo..." : "Sin equipos en categoría")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Buscar equipo..." />
                        <CommandList>
                            <CommandEmpty>No se encontró el equipo.</CommandEmpty>
                            <CommandGroup>
                                {teams.map((team) => (
                                    <CommandItem
                                        key={team.id}
                                        value={`${team.name}${team.subName || ''}`}
                                        onSelect={() => {
                                            onSelectTeam(team.id);
                                            setOpen(false);
                                        }}
                                        disabled={team.id === disabledTeamId}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", selectedTeamId === team.id ? "opacity-100" : "opacity-0")} />
                                        <span className="truncate">{team.name}{team.subName ? ` (${team.subName})` : ''}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};


export function GameSetupDialog({ isOpen, onOpenChange, onGameReset, onLoadMatchConfig }: GameSetupDialogProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  
  const { selectedTournamentId, tournaments } = state.config;
  const selectedTournament = useMemo(() => tournaments.find(t => t.id === selectedTournamentId), [tournaments, selectedTournamentId]);

  const [localCategoryId, setLocalCategoryId] = useState(state.config.selectedMatchCategory || '');
  const [homeTeamId, setHomeTeamId] = useState('');
  const [awayTeamId, setAwayTeamId] = useState('');
  
  const availableCategories = useMemo(() => selectedTournament?.categories || [], [selectedTournament]);

  const teamsInCategory = useMemo(() => {
    if (!selectedTournament || !localCategoryId) return [];
    return selectedTournament.teams.filter(t => t.category === localCategoryId);
  }, [selectedTournament, localCategoryId]);
  
  // Effect to load config from a selected match
  useEffect(() => {
    if (isOpen && state.live.pendingMatchConfig) {
      const { categoryId, homeTeamId, awayTeamId } = state.live.pendingMatchConfig;
      setLocalCategoryId(categoryId);
      setHomeTeamId(homeTeamId);
      setAwayTeamId(awayTeamId);
      // Clear the pending config so it doesn't get re-applied on subsequent opens
      dispatch({ type: 'UPDATE_LIVE_STATE', payload: { pendingMatchConfig: undefined } });
    } else if (isOpen) {
      // If opening manually, reset to defaults
      setLocalCategoryId(state.config.selectedMatchCategory || '');
      setHomeTeamId('');
      setAwayTeamId('');
    }
  }, [isOpen, state.live.pendingMatchConfig, state.config.selectedMatchCategory, dispatch]);

  useEffect(() => {
    // Reset team selections if category changes
    setHomeTeamId('');
    setAwayTeamId('');
  }, [localCategoryId]);


  const handleStartGame = () => {
    if (!homeTeamId || !awayTeamId || !localCategoryId) {
      toast({
        title: "Datos Incompletos",
        description: "Por favor, selecciona una categoría y ambos equipos para iniciar.",
        variant: "destructive",
      });
      return;
    }

    const homeTeam = teamsInCategory.find(t => t.id === homeTeamId);
    const awayTeam = teamsInCategory.find(t => t.id === awayTeamId);

    if (!homeTeam || !awayTeam) {
        toast({ title: "Error", description: "No se pudieron encontrar los datos de los equipos seleccionados.", variant: "destructive" });
        return;
    }

    dispatch({ type: 'SET_SELECTED_MATCH_CATEGORY', payload: localCategoryId });
    dispatch({ type: 'SET_HOME_TEAM_NAME', payload: homeTeam.name });
    dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: homeTeam.subName });
    dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: awayTeam.name });
    dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: awayTeam.subName });
    
    // Set attendance for both teams
    dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'home', playerIds: homeTeam.players.map(p => p.id) }});
    dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'away', playerIds: awayTeam.players.map(p => p.id) }});


    onGameReset();
    toast({
      title: "¡Partido Iniciado!",
      description: `${homeTeam.name} vs ${awayTeam.name}. ¡Mucha suerte!`
    });
    onOpenChange(false);
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Iniciar Nuevo Partido</DialogTitle>
            <DialogDescription>
              Selecciona la categoría y los equipos. Esto reiniciará el partido actual y cargará los jugadores para las estadísticas.
            </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
            <div className="space-y-2">
                <Label>Categoría</Label>
                 <Select value={localCategoryId} onValueChange={setLocalCategoryId}>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder={availableCategories.length > 0 ? "Seleccionar categoría..." : "Sin categorías"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
           
           <TeamSelector
                label="Equipo Local"
                teams={teamsInCategory}
                selectedTeamId={homeTeamId}
                onSelectTeam={setHomeTeamId}
                disabledTeamId={awayTeamId}
                disabled={!localCategoryId}
           />

           <TeamSelector
                label="Equipo Visitante"
                teams={teamsInCategory}
                selectedTeamId={awayTeamId}
                onSelectTeam={setAwayTeamId}
                disabledTeamId={homeTeamId}
                disabled={!localCategoryId}
           />
        </div>
       
        <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleStartGame}>
              Iniciar Partido
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
