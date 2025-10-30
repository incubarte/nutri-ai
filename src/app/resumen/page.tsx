
"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useGameState, getCategoryNameById, type GameState } from "@/contexts/game-state-context";
import type { SummaryPlayerStats, GameSummary, ShootoutState, CategoryData, TeamData, MatchData } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Info, RefreshCw, AlertTriangle, Edit3, Check, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";
import { AddPenaltyForm } from "@/components/shared/add-penalty-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDesc, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertTitle } from "@/components/ui/alert-dialog";
import { GoalsSection } from "@/components/summary/goals-section";
import { PenaltiesSection } from "@/components/summary/penalties-section";
import { PlayerStatsSection } from "@/components/summary/player-stats-section";
import { ShootoutSection } from "@/components/summary/shootout-section";
import { getPeriodText } from "@/contexts/game-state-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Team, GoalLog, PenaltyLog, ShotLog, AttendedPlayerInfo } from "@/types";

// --- Modelos de Datos para la Página de Resumen ---
export interface PeriodStats {
  home: { goals: GoalLog[]; penalties: PenaltyLog[]; playerStats: SummaryPlayerStats[]; };
  away: { goals: GoalLog[]; penalties: PenaltyLog[]; playerStats: SummaryPlayerStats[]; };
}

export interface SummaryData {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  categoryName: string;
  statsByPeriod: Record<string, PeriodStats>;
  attendance: {
      home: AttendedPlayerInfo[];
      away: AttendedPlayerInfo[];
  };
  shootout?: ShootoutState;
  // Extra data for PDF generation
  availableCategories: CategoryData[];
  teams: TeamData[];
  selectedMatchCategory: string;
}
// --- Fin de Modelos de Datos ---


export default function ResumenPage() {
  const { state, dispatch, isLoading } = useGameState();
  const { toast } = useToast();
  
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isAddPenaltyDialogOpen, setIsAddPenaltyDialogOpen] = useState(false);
  const [penaltyContext, setPenaltyContext] = useState<{ team: Team, periodText?: string } | null>(null);
  const [penaltyToDelete, setPenaltyToDelete] = useState<{ team: Team, periodText: string, logId: string } | null>(null);
  const [overwriteConfirm, setOverwriteConfirm] = useState<{ onConfirm: () => void } | null>(null);
  const [unassignedPlayerWarning, setUnassignedPlayerWarning] = useState<{ players: string[]; onConfirm: () => void } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editedShots, setEditedShots] = useState<Record<string, Record<string, string>>>({}); // { [period]: { [playerId]: count } }
  const [refreshKey, setRefreshKey] = useState(0);
  
  const generateSummaryData = useCallback(() => {
    setSummaryData(null); 
    const { live, config } = state;
    if (!live || !config) return;
    
    const { gameSummary, shootout } = live;

    const statsByPeriod: Record<string, PeriodStats> = {};
    
    const playedPeriodNumbers = new Set<number>();
    
    const lastPlayedPeriodNumber = live.clock.currentPeriod;
    if (lastPlayedPeriodNumber > 0) {
      for (let i = 1; i <= lastPlayedPeriodNumber; i++) {
        playedPeriodNumbers.add(i);
      }
    }
    
    const allEvents = [...gameSummary.home.goals, ...gameSummary.away.goals, ...gameSummary.home.penalties, ...gameSummary.away.penalties];
    allEvents.forEach(event => {
        const periodText = (event as GoalLog).periodText || (event as PenaltyLog).addPeriodText;
        if (periodText && !periodText.toLowerCase().includes('warm-up') && !periodText.toLowerCase().includes('break')) {
             const periodNum = parseInt(periodText.replace(/\D/g, ''), 10);
             if (!isNaN(periodNum) && periodNum > 0) playedPeriodNumbers.add(periodNum);
        }
    });

    const sortedPeriodNumbers = Array.from(playedPeriodNumbers).sort((a,b) => a - b);
    
    const allPeriodTexts = sortedPeriodNumbers
        .map(num => getPeriodText(num, config.numberOfRegularPeriods))
        .filter(text => text && !text.toLowerCase().includes('warm-up') && !text.toLowerCase().includes('break'));


    allPeriodTexts.forEach(period => {
        statsByPeriod[period] = {
            home: { goals: [], penalties: [], playerStats: [] },
            away: { goals: [], penalties: [], playerStats: [] },
        };
        const processTeamPeriod = (team: Team) => {
            const attendance = gameSummary.attendance[team];
            const playerStatsMap = new Map<string, SummaryPlayerStats>();
            attendance.forEach(p => {
                playerStatsMap.set(p.id, { id: p.id, number: p.number, name: p.name, goals: 0, assists: 0, shots: 0 });
            });

            const teamGoals = gameSummary[team].goals.filter(g => g.periodText === period);
            teamGoals.forEach(g => {
                const scorerId = attendance.find(p => p.number === g.scorer?.playerNumber)?.id;
                if (scorerId && playerStatsMap.has(scorerId)) playerStatsMap.get(scorerId)!.goals++;
                
                const assistId = attendance.find(p => p.number === g.assist?.playerNumber)?.id;
                if (assistId && playerStatsMap.has(assistId)) playerStatsMap.get(assistId)!.assists++;
            });

            const shotsLogKey = `${team}ShotsLog` as const;
            const teamShots = (gameSummary[team][shotsLogKey] || []).filter(s => s.periodText === period);

            teamShots.forEach(s => {
                if (s.playerId && playerStatsMap.has(s.playerId)) {
                  playerStatsMap.get(s.playerId)!.shots++;
                }
            });

            const teamPenalties = gameSummary[team].penalties.filter(p => p.addPeriodText === period);
            
            statsByPeriod[period][team] = {
                goals: teamGoals,
                penalties: teamPenalties,
                playerStats: Array.from(playerStatsMap.values())
            };
        };
        processTeamPeriod('home');
        processTeamPeriod('away');
    });

    const selectedTournament = config.tournaments.find(t => t.id === config.selectedTournamentId);
    
    const newSummaryData: SummaryData = {
        homeTeamName: live.homeTeamName,
        awayTeamName: live.awayTeamName,
        homeScore: live.score.home,
        awayScore: live.score.away,
        categoryName: getCategoryNameById(config.selectedMatchCategory, selectedTournament?.categories) || 'N/A',
        attendance: gameSummary.attendance,
        statsByPeriod,
        shootout: shootout.isActive ? shootout : undefined,
        availableCategories: selectedTournament?.categories || [],
        teams: selectedTournament?.teams || [],
        selectedMatchCategory: config.selectedMatchCategory,
    };
    setSummaryData(newSummaryData);
    toast({ title: "Resumen Generado", description: "Se han cargado los datos del partido actual." });

  }, [state, toast]);

  const handleGenerateSummaryClick = () => {
    const unassignedHome = state.live.gameSummary.attendance.home.filter(p => !p.number).map(p => p.name);
    const unassignedAway = state.live.gameSummary.attendance.away.filter(p => !p.number).map(p => p.name);
    const allUnassigned = [...unassignedHome, ...unassignedAway];

    const confirmAndGenerate = () => {
      if (allUnassigned.length > 0) {
        setUnassignedPlayerWarning({ players: allUnassigned, onConfirm: generateSummaryData });
      } else {
        generateSummaryData();
      }
    };
    
    if (summaryData) {
      setOverwriteConfirm({ onConfirm: confirmAndGenerate });
    } else {
      confirmAndGenerate();
    }
  };

  const homeAggregatedStats = useMemo(() => {
    if (!summaryData) return { goals: [], penalties: [], playerStats: [] };
    const allGoals: GoalLog[] = [];
    const allPenalties: PenaltyLog[] = [];
    Object.values(summaryData.statsByPeriod).forEach(periodStats => {
        allGoals.push(...(periodStats.home.goals || []));
        allPenalties.push(...(periodStats.home.penalties || []));
    });
    
    return {
      goals: allGoals.sort((a, b) => a.timestamp - b.timestamp),
      penalties: allPenalties.sort((a, b) => a.addTimestamp - b.addTimestamp),
      playerStats: state.live.gameSummary.home.playerStats,
    }
  }, [summaryData, state.live.gameSummary]);

  const awayAggregatedStats = useMemo(() => {
    if (!summaryData) return { goals: [], penalties: [], playerStats: [] };
    const allGoals: GoalLog[] = [];
    const allPenalties: PenaltyLog[] = [];
    Object.values(summaryData.statsByPeriod).forEach(periodStats => {
        allGoals.push(...(periodStats.away.goals || []));
        allPenalties.push(...(periodStats.away.penalties || []));
    });
    return {
      goals: allGoals.sort((a, b) => a.timestamp - b.timestamp),
      penalties: allPenalties.sort((a, b) => a.addTimestamp - b.addTimestamp),
      playerStats: state.live.gameSummary.away.playerStats,
    }
  }, [summaryData, state.live.gameSummary]);

  const handleSaveAndExport = async () => {
    if (!summaryData || !state.live.matchId) {
        toast({
            title: "No hay resumen o partido activo",
            description: "Genera un resumen y asegúrate de que el partido se inició desde el fixture.",
            variant: "destructive"
        });
        return;
    }

    setIsSaving(true);
    toast({ title: "Guardando Resumen...", description: "Por favor, espera." });
    
    const finalSummary: GameSummary = {
        home: {
            goals: homeAggregatedStats.goals,
            penalties: homeAggregatedStats.penalties,
            playerStats: homeAggregatedStats.playerStats,
            homeShotsLog: state.live.gameSummary.home.homeShotsLog,
        },
        away: {
            goals: awayAggregatedStats.goals,
            penalties: awayAggregatedStats.penalties,
            playerStats: awayAggregatedStats.playerStats,
            awayShotsLog: state.live.gameSummary.away.awayShotsLog,
        },
        attendance: summaryData.attendance,
        shootout: summaryData.shootout,
        statsByPeriod: summaryData.statsByPeriod,
    };

    dispatch({
        type: 'SAVE_MATCH_SUMMARY',
        payload: {
            matchId: state.live.matchId,
            summary: finalSummary
        }
    });

    // Let the state update propagate, then toast
    setTimeout(() => {
        setIsSaving(false);
        toast({
            title: "Resumen Guardado",
            description: "El resumen del partido se ha guardado en la base de datos.",
        });
    }, 500);
};

  const handleStatsChange = (team: Team, newStats: SummaryPlayerStats[], period: string) => {
    // This function will now be a NO-OP as editing is handled inside the Fixture Dialog
  };

  const allPeriodTexts = useMemo(() => {
    if (!summaryData?.statsByPeriod) return [];
    
    const getPeriodSortValue = (periodText: string): number => {
        if (!periodText) return 999;
        if (periodText.toUpperCase().startsWith('SHOOTOUT') || periodText.toUpperCase().startsWith('PENALES')) return 1000;
        if (periodText.toUpperCase().startsWith('OT')) {
            const numPart = periodText.replace(/\D/g, '');
            const otNumber = numPart ? parseInt(numPart, 10) : 1;
            return (state.config?.numberOfRegularPeriods || 0) + otNumber;
        }
        const num = parseInt(periodText.replace(/\D/g, ''), 10);
        return isNaN(num) ? 999 : num;
    };
    
    const periods = new Set(Object.keys(summaryData.statsByPeriod));
    if (summaryData.shootout && (summaryData.shootout.homeAttempts.length > 0 || summaryData.shootout.awayAttempts.length > 0)) {
        periods.add("Shootout");
    }

    return Array.from(periods).sort((a, b) => getPeriodSortValue(a) - getPeriodSortValue(b));
  }, [summaryData, state.config?.numberOfRegularPeriods]);

  const handleEditClick = () => {
    if (!summaryData?.statsByPeriod) return;
    const initialShots: Record<string, Record<string, string>> = {};
    for (const period in summaryData.statsByPeriod) {
        initialShots[period] = {};
        for(const team of ['home', 'away'] as const) {
            summaryData.statsByPeriod[period][team].playerStats.forEach(p => {
                initialShots[period][p.id] = String(p.shots || 0);
            });
        }
    }
    setEditedShots(initialShots);
    setIsEditing(true);
  };
  
  const handleCancelClick = () => setIsEditing(false);

  const handleSaveClick = () => {
    if (!summaryData) return;
    
    let hasChanges = false;
    const newSummary = JSON.parse(JSON.stringify(summaryData));

    for (const period in editedShots) {
        for (const team of ['home', 'away'] as const) {
            newSummary.statsByPeriod[period][team].playerStats.forEach((pStat: SummaryPlayerStats) => {
                const newShotCountStr = editedShots[period]?.[pStat.id];
                if (newShotCountStr !== undefined) {
                    const newShotCount = parseInt(newShotCountStr, 10);
                    if (!isNaN(newShotCount) && newShotCount !== pStat.shots) {
                        pStat.shots = newShotCount;
                        hasChanges = true;
                    }
                }
            });
        }
    }

    if(hasChanges) {
        setSummaryData(newSummary);
        setRefreshKey(k => k + 1);
        toast({ title: "Tiros Actualizados", description: "Los cambios se guardaron localmente. Haz clic en 'Guardar Resumen en DB' para persistir."});
    } else {
        toast({ title: "Sin Cambios", description: "No se detectaron modificaciones en los tiros."});
    }

    setIsEditing(false);
  };

  const handleShotInputChange = (period: string, playerId: string, value: string) => {
    if (/^\d*$/.test(value)) { // Only allow digits
        setEditedShots(prev => ({
            ...prev,
            [period]: {
                ...prev[period],
                [playerId]: value,
            }
        }));
    }
  };


  if (isLoading) {
    return (
        <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
            <HockeyPuckSpinner className="h-24 w-24 text-primary mb-4" />
            <p className="text-xl text-foreground">Cargando...</p>
        </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-3xl font-bold text-primary-foreground">Resumen del Partido</h1>
            <div className="flex gap-2">
                <Button onClick={handleGenerateSummaryClick} variant="outline"><RefreshCw className="mr-2 h-4 w-4"/> Recargar Datos del Partido</Button>
                <Button onClick={handleSaveAndExport} disabled={!summaryData || isSaving || !state.live.matchId}>
                    {isSaving ? <HockeyPuckSpinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4"/>}
                    Guardar Resumen en DB
                </Button>
            </div>
        </div>

        {!summaryData ? (
             <div className="text-center py-20 border-2 border-dashed rounded-lg bg-card/50">
                <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold">Resumen no generado</h2>
                <p className="text-muted-foreground">Haz clic en "Recargar Datos" para cargar las estadísticas del partido actual.</p>
            </div>
        ) : (
            <>
                <div className="grid grid-cols-2 text-center my-2">
                    <h3 className="text-2xl font-bold text-primary">{summaryData.homeTeamName} - <span className="text-accent">{summaryData.homeScore}</span></h3>
                    <h3 className="text-2xl font-bold text-primary">{summaryData.awayTeamName} - <span className="text-accent">{summaryData.awayScore}</span></h3>
                </div>
                
                <Tabs defaultValue="general">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="general">Estadísticas Generales</TabsTrigger>
                        <TabsTrigger value="periods">Detalle por Periodo</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="mt-6">
                        <ScrollArea className="h-[calc(100vh-22rem)]">
                            <div className="space-y-6 pr-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <GoalsSection teamName={summaryData.homeTeamName} goals={homeAggregatedStats.goals} />
                                    <GoalsSection teamName={summaryData.awayTeamName} goals={awayAggregatedStats.goals} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <PenaltiesSection team="home" teamName={summaryData.homeTeamName} penalties={homeAggregatedStats.penalties} />
                                     <PenaltiesSection team="away" teamName={summaryData.awayTeamName} penalties={awayAggregatedStats.penalties} />
                                </div>
                                
                                {summaryData.shootout && (summaryData.shootout.homeAttempts.length > 0 || summaryData.shootout.awayAttempts.length > 0) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <ShootoutSection teamName={summaryData.homeTeamName} attempts={summaryData.shootout.homeAttempts} />
                                        <ShootoutSection teamName={summaryData.awayTeamName} attempts={summaryData.shootout.awayAttempts} />
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <PlayerStatsSection teamName={summaryData.homeTeamName} playerStats={homeAggregatedStats.playerStats} />
                                    <PlayerStatsSection teamName={summaryData.awayTeamName} playerStats={awayAggregatedStats.playerStats} />
                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="periods" className="mt-6">
                        <ScrollArea className="h-[calc(100vh-22rem)]">
                            <Accordion type="single" collapsible className="w-full pr-4">
                                {allPeriodTexts.map(periodText => {
                                    if (periodText.toUpperCase() === 'SHOOTOUT') {
                                        if (!summaryData.shootout || (summaryData.shootout.homeAttempts.length === 0 && summaryData.shootout.awayAttempts.length === 0)) return null;
                                        return (
                                            <AccordionItem value="shootout" key="shootout">
                                                <AccordionTrigger className="text-xl hover:no-underline">Shootout</AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-8 pl-2">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <ShootoutSection teamName={summaryData.homeTeamName} attempts={summaryData.shootout.homeAttempts} />
                                                            <ShootoutSection teamName={summaryData.awayTeamName} attempts={summaryData.shootout.awayAttempts} />
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    }

                                    const periodStats = summaryData.statsByPeriod[periodText];
                                    if (!periodStats) return null;

                                    return (
                                        <AccordionItem value={periodText} key={periodText}>
                                            <AccordionTrigger className="text-xl hover:no-underline">{periodText}</AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-4">
                                                     <div className="flex justify-end pr-2">
                                                        {isEditing ? (
                                                            <div className="flex gap-2">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" onClick={handleSaveClick}><Check className="h-5 w-5" /></Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleCancelClick}><XCircle className="h-5 w-5" /></Button>
                                                            </div>
                                                        ) : (
                                                            <Button variant="outline" size="sm" onClick={handleEditClick}>
                                                                <Edit3 className="mr-2 h-4 w-4"/>Editar Tiros
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <div className="space-y-8 pl-2">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <GoalsSection teamName={summaryData.homeTeamName} goals={periodStats.home.goals} />
                                                            <GoalsSection teamName={summaryData.awayTeamName} goals={periodStats.away.goals} />
                                                        </div>
                                                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <PenaltiesSection team="home" teamName={summaryData.homeTeamName} penalties={periodStats.home.penalties} />
                                                            <PenaltiesSection team="away" teamName={summaryData.awayTeamName} penalties={periodStats.away.penalties} />
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <PlayerStatsSection 
                                                                teamName={summaryData.homeTeamName} 
                                                                playerStats={periodStats.home.playerStats}
                                                                editable={isEditing}
                                                                editedShots={editedShots[periodText]}
                                                                onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)}
                                                            />
                                                            <PlayerStatsSection 
                                                                teamName={summaryData.awayTeamName} 
                                                                playerStats={periodStats.away.playerStats}
                                                                editable={isEditing}
                                                                editedShots={editedShots[periodText]}
                                                                onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )
                                })}
                            </Accordion>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </>
        )}
        
        {overwriteConfirm && (
            <AlertDialog open={!!overwriteConfirm} onOpenChange={() => setOverwriteConfirm(null)}>
                <AlertDialogContent>
                    <AlertTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" /> Confirmar Recarga de Datos</AlertTitle>
                    <AlertDialogDesc>
                        Ya existe un resumen generado. Si continúas, se perderán todos los cambios manuales que hayas hecho en este resumen. ¿Deseas continuar y reemplazar los datos?
                    </AlertDialogDesc>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setOverwriteConfirm(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { overwriteConfirm.onConfirm(); setOverwriteConfirm(null); }}>
                            Sí, Recargar Datos
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}

        {unassignedPlayerWarning && (
            <AlertDialog open={!!unassignedPlayerWarning} onOpenChange={() => setUnassignedPlayerWarning(null)}>
                <AlertDialogContent>
                    <AlertTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" /> Jugadores sin Número Asignado</AlertTitle>
                    <AlertDialogDesc>
                        Los siguientes jugadores tienen asistencia registrada pero no tienen un número asignado. Si continúas, no podrás editar sus estadísticas de tiros más adelante.
                    </AlertDialogDesc>
                    <ScrollArea className="max-h-32 mt-4 border bg-muted/50 p-2 rounded-md">
                        <ul className="list-disc pl-5">
                            {unassignedPlayerWarning.players.map((name, i) => <li key={i}>{name}</li>)}
                        </ul>
                    </ScrollArea>
                    <p className="text-sm text-muted-foreground mt-2">
                        ¿Deseas generar el resumen de todas formas?
                    </p>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setUnassignedPlayerWarning(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { unassignedPlayerWarning.onConfirm(); setUnassignedPlayerWarning(null); }}>
                            Generar de Todas Formas
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
    </div>
  );
}
