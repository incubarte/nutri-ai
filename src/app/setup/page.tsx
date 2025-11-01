
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useGameState, type FormatAndTimingsProfileData } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { TeamData, MatchData } from '@/types';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, CalendarCheck, ArrowLeft, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DurationSettingsCard } from '@/components/config/duration-settings-card';
import { PenaltySettingsCard } from '@/components/config/penalty-settings-card';
import { StoppedTimeAlertCard } from '@/components/config/stopped-time-alert-card';
import { isToday, format } from 'date-fns';
import { es } from 'date-fns/locale';

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

export default function SetupPage() {
    const { state, dispatch } = useGameState();
    const router = useRouter();
    const { toast } = useToast();
    
    const [activeTab, setActiveTab] = useState('teams');
    
    const { selectedTournamentId, tournaments } = state.config;
    const selectedTournament = useMemo(() => tournaments.find(t => t.id === selectedTournamentId), [tournaments, selectedTournamentId]);
    
    const [useManualTeamNames, setUseManualTeamNames] = useState(false);
    const [manualHomeTeamName, setManualHomeTeamName] = useState('Local');
    const [manualAwayTeamName, setManualAwayTeamName] = useState('Visitante');
    const [localCategoryId, setLocalCategoryId] = useState('');
    const [homeTeamId, setHomeTeamId] = useState('');
    const [awayTeamId, setAwayTeamId] = useState('');
    
    const [tempFormatSettings, setTempFormatSettings] = useState<Partial<FormatAndTimingsProfileData>>({});
    
    const [todaysMatches, setTodaysMatches] = useState<MatchData[]>([]);
    const [pendingMatchConfig, setPendingMatchConfig] = useState<any>(null);


    const availableCategories = useMemo(() => selectedTournament?.categories || [], [selectedTournament]);

    const teamsInCategory = useMemo(() => {
        if (!selectedTournament || !selectedTournament.teams || !localCategoryId) return [];
        return selectedTournament.teams.filter(t => t.category === localCategoryId);
    }, [selectedTournament, localCategoryId]);

    useEffect(() => {
        const selectedTournament = (state.config.tournaments || []).find(t => t.id === state.config.selectedTournamentId);
        if (!selectedTournament || !selectedTournament.matches || selectedTournament.matches.length === 0) {
            setTodaysMatches([]);
            return;
        }

        const todayMatches = selectedTournament.matches.filter(match => isToday(new Date(match.date)));
        setTodaysMatches(todayMatches);
    }, [state.config.tournaments, state.config.selectedTournamentId]);

     useEffect(() => {
        // This effect runs only when the page loads or the active tournament changes.
        setLocalCategoryId(state.config.selectedMatchCategory || availableCategories[0]?.id || '');
        const currentProfile = state.config.formatAndTimingsProfiles.find(p => p.id === state.config.selectedFormatAndTimingsProfileId) || state.config;
        setTempFormatSettings(currentProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.config.selectedTournamentId]);

    const handleLoadMatchConfig = (match: MatchData) => {
        setUseManualTeamNames(false);
        setLocalCategoryId(match.categoryId);
        setHomeTeamId(match.homeTeamId);
        setAwayTeamId(match.awayTeamId);
        setPendingMatchConfig({
            matchId: match.id,
            categoryId: match.categoryId,
            homeTeamId: match.homeTeamId,
            awayTeamId: match.awayTeamId,
        });
        setActiveTab('rules');
    };
    
    const handleNextStep = (nextTab: 'rules' | 'summary') => {
        if (activeTab === 'teams') {
            if (useManualTeamNames) {
                const homeName = manualHomeTeamName.trim() || 'Local';
                const awayName = manualAwayTeamName.trim() || 'Visitante';
                if (homeName.toLowerCase() === awayName.toLowerCase()) {
                    toast({ title: "Nombres Iguales", description: "Los nombres de los equipos no pueden ser el mismo.", variant: "destructive" });
                    return;
                }
            } else {
                 if (!pendingMatchConfig && (!homeTeamId || !awayTeamId || !localCategoryId)) {
                    toast({ title: "Datos Incompletos", description: "Por favor, selecciona una categoría y ambos equipos para continuar.", variant: "destructive" });
                    return;
                }
                 if (!pendingMatchConfig) {
                    setPendingMatchConfig({
                        matchId: null, // This is not a fixture match
                        categoryId: localCategoryId,
                        homeTeamId: homeTeamId,
                        awayTeamId: awayTeamId,
                    });
                }
            }
        }
        setActiveTab(nextTab);
    };
  
    const handleConfirmAndStart = () => {
        dispatch({ type: 'RESET_GAME_STATE' });
        
        let matchIdToSet: string | null = null;
        
        if (useManualTeamNames) {
            const homeName = manualHomeTeamName.trim() || 'Local';
            const awayName = manualAwayTeamName.trim() || 'Visitante';
            dispatch({ type: 'SET_HOME_TEAM_NAME', payload: homeName });
            dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: awayName });
            dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: undefined });
            dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: undefined });
            dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'home', playerIds: [] }});
            dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'away', playerIds: [] }});
        } else {
            const homeTeam = teamsInCategory.find(t => t.id === homeTeamId);
            const awayTeam = teamsInCategory.find(t => t.id === awayTeamId);

            if (!homeTeam || !awayTeam) {
                toast({ title: "Error", description: "No se pudieron encontrar los datos de los equipos.", variant: "destructive" });
                return;
            }

            dispatch({ type: 'SET_SELECTED_MATCH_CATEGORY', payload: localCategoryId });
            dispatch({ type: 'SET_HOME_TEAM_NAME', payload: homeTeam.name });
            dispatch({ type: 'SET_HOME_TEAM_SUB_NAME', payload: homeTeam.subName });
            dispatch({ type: 'SET_AWAY_TEAM_NAME', payload: awayTeam.name });
            dispatch({ type: 'SET_AWAY_TEAM_SUB_NAME', payload: awayTeam.subName });
            dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'home', playerIds: homeTeam.players.map(p => p.id) }});
            dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'away', playerIds: awayTeam.players.map(p => p.id) }});
            
            if (pendingMatchConfig) {
              matchIdToSet = pendingMatchConfig.matchId;
            }
        }

        dispatch({ type: 'UPDATE_SELECTED_FT_PROFILE_DATA', payload: tempFormatSettings });
        dispatch({ type: 'UPDATE_LIVE_STATE', payload: { matchId: matchIdToSet } });

        
        toast({ title: "¡Partido Listo!", description: "Se ha configurado un nuevo partido. Redirigiendo a controles..." });
        
        router.push('/controls');
    }

    return (
        <div className="w-full max-w-4xl mx-auto py-8 space-y-6">
            <Button variant="outline" onClick={() => router.push('/controls')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver a Controles
            </Button>
            <div className="border bg-card rounded-lg p-6">
                <div className="mb-4">
                    <h1 className="text-3xl font-bold">Configurar Nuevo Partido</h1>
                    <p className="text-muted-foreground">Configura los equipos y las reglas para el próximo partido.</p>
                </div>
                
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="teams">Paso 1: Equipos</TabsTrigger>
                        <TabsTrigger value="rules">Paso 2: Reglas</TabsTrigger>
                        <TabsTrigger value="summary">Paso 3: Resumen</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="teams" className="py-4 space-y-6">
                         {todaysMatches.length > 0 && (
                            <div className="space-y-3 p-4 border-2 border-dashed rounded-lg bg-muted/30">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <CalendarCheck className="h-5 w-5 text-primary"/>
                                    Partidos Programados para Hoy
                                </h3>
                                <div className="grid grid-cols-1 gap-2">
                                     {todaysMatches.map(match => {
                                        const homeTeam = selectedTournament?.teams.find(t => t.id === match.homeTeamId);
                                        const awayTeam = selectedTournament?.teams.find(t => t.id === match.awayTeamId);

                                        return (
                                            <Button
                                                key={match.id}
                                                variant="outline"
                                                className="w-full justify-start h-auto text-left py-2"
                                                onClick={() => handleLoadMatchConfig(match)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{format(new Date(match.date), 'HH:mm')}hs - {homeTeam?.name || '?'} vs {awayTeam?.name || '?'}</span>
                                                    <span className="text-xs text-muted-foreground">Cat: {availableCategories.find(c => c.id === match.categoryId)?.name || 'N/A'}</span>
                                                </div>
                                            </Button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                        
                        {useManualTeamNames ? (
                            <div className="space-y-4">
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="manual-home-name">Nombre del Equipo Local</Label>
                                    <Input id="manual-home-name" value={manualHomeTeamName} onChange={(e) => setManualHomeTeamName(e.target.value)} />
                                </div>
                                <div className="grid w-full items-center gap-1.5">
                                    <Label htmlFor="manual-away-name">Nombre del Equipo Visitante</Label>
                                    <Input id="manual-away-name" value={manualAwayTeamName} onChange={(e) => setManualAwayTeamName(e.target.value)} />
                                </div>
                                 <div className="flex items-center space-x-2 pt-2">
                                    <Switch id="manual-team-names-switch-inner" checked={useManualTeamNames} onCheckedChange={setUseManualTeamNames} />
                                    <Label htmlFor="manual-team-names-switch-inner">Ingresar nombres de equipo manualmente</Label>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
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
                                <TeamSelector label="Equipo Local" teams={teamsInCategory} selectedTeamId={homeTeamId} onSelectTeam={setHomeTeamId} disabledTeamId={awayTeamId} disabled={!localCategoryId} />
                                <TeamSelector label="Equipo Visitante" teams={teamsInCategory} selectedTeamId={awayTeamId} onSelectTeam={setAwayTeamId} disabledTeamId={homeTeamId} disabled={!localCategoryId} />
                                <div className="flex items-center space-x-2 pt-2">
                                    <Switch id="manual-team-names-switch-outer" checked={useManualTeamNames} onCheckedChange={setUseManualTeamNames} />
                                    <Label htmlFor="manual-team-names-switch-outer">Ingresar nombres de equipo manualmente</Label>
                                </div>
                            </div>
                        )}

                        <Separator />

                         <div className="p-3 bg-muted/20 border border-muted/40 rounded-lg text-muted-foreground text-sm">
                            <p><strong>Nota:</strong> Los partidos configurados manualmente (o que no se cargan desde el fixture) <strong className="text-foreground/80">NO GENERAN</strong> un archivo de resumen de partido al finalizar. Si es un partido de torneo, por favor, agrégalo al Fixture primero.</p>
                        </div>

                    </TabsContent>

                    <TabsContent value="rules" className="py-4 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-6">
                            <DurationSettingsCard isDialogMode={true} tempSettings={tempFormatSettings} onSettingsChange={setTempFormatSettings} />
                            <Separator />
                            <div className="flex flex-col gap-6">
                                <PenaltySettingsCard isDialogMode={true} tempSettings={tempFormatSettings} onSettingsChange={setTempFormatSettings} />
                                <StoppedTimeAlertCard isDialogMode={true} tempSettings={tempFormatSettings} onSettingsChange={setTempFormatSettings} />
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="summary" className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                        <h3 className="text-lg font-semibold">Resumen de Configuración</h3>

                        {!pendingMatchConfig?.matchId && (
                            <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive-foreground">
                                <AlertTriangle className="h-6 w-6 text-destructive mt-1"/>
                                <div>
                                    <h4 className="font-bold text-destructive">¡ATENCIÓN!</h4>
                                    <p className="text-sm">Este partido no se cargó desde el Fixture. <strong className="font-semibold">NO SE GENERARÁ UN ARCHIVO DE RESUMEN</strong> al finalizar. Si es un partido oficial, cancélalo y cárgalo desde la lista de "Partidos Programados para Hoy".</p>
                                </div>
                            </div>
                        )}

                        <div className="space-y-4 rounded-md border p-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="font-medium">Equipo Local</h4>
                                    <p className="text-muted-foreground">{useManualTeamNames ? manualHomeTeamName : teamsInCategory.find(t => t.id === homeTeamId)?.name || 'N/A'}</p>
                                </div>
                                <div>
                                    <h4 className="font-medium">Equipo Visitante</h4>
                                    <p className="text-muted-foreground">{useManualTeamNames ? manualAwayTeamName : teamsInCategory.find(t => t.id === awayTeamId)?.name || 'N/A'}</p>
                                </div>
                            </div>
                            {!useManualTeamNames && (
                                <div>
                                    <h4 className="font-medium">Categoría</h4>
                                    <p className="text-muted-foreground">{availableCategories.find(c => c.id === localCategoryId)?.name || 'N/A'}</p>
                                </div>
                            )}
                            <Separator />
                            <div>
                                <h4 className="font-medium">Reglas del Partido</h4>
                                <ul className="list-disc list-inside text-muted-foreground text-sm mt-2 space-y-1">
                                    <li>Períodos: {tempFormatSettings.numberOfRegularPeriods} de {tempFormatSettings.defaultPeriodDuration! / 6000} min</li>
                                    <li>Overtime: {tempFormatSettings.numberOfOvertimePeriods} de {tempFormatSettings.defaultOTPeriodDuration! / 6000} min</li>
                                    <li>Jugadores en cancha: {tempFormatSettings.playersPerTeamOnIce}</li>
                                    <li>Penalidades concurrentes: {tempFormatSettings.maxConcurrentPenalties}</li>
                                    <li>Modo de Tiempo: {tempFormatSettings.gameTimeMode === 'running' ? 'Corrido' : 'Pausado'}</li>
                                </ul>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            
                <div className="flex justify-end mt-4">
                    {activeTab === "teams" && <Button onClick={() => handleNextStep('rules')}>Siguiente</Button>}
                    {activeTab === "rules" && <Button onClick={() => handleNextStep('summary')}>Ir a Resumen</Button>}
                    {activeTab === "summary" && <Button onClick={handleConfirmAndStart}>Confirmar e Iniciar Partido</Button>}
                </div>
            </div>
        </div>
    );
}

