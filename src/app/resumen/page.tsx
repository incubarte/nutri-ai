
"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useGameState, getCategoryNameById, type GameState } from "@/contexts/game-state-context";
import type { SummaryPlayerStats, GameSummary, ShootoutState, CategoryData, TeamData, MatchData, GoalLog, PenaltyLog, Team } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Info, RefreshCw, AlertTriangle, Edit3, Check, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";
import { GoalsSection } from "@/components/summary/goals-section";
import { PenaltiesSection } from "@/components/summary/penalties-section";
import { PlayerStatsSection } from "@/components/summary/player-stats-section";
import { ShootoutSection } from "@/components/summary/shootout-section";
import { getPeriodText } from "@/contexts/game-state-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AddPenaltyForm } from "@/components/shared/add-penalty-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { safeUUID } from "@/lib/utils";

// --- Modelos de Datos para la Página de Resumen ---
interface SummaryData {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  categoryName: string;
  statsByPeriod: Record<string, {
    home: { goals: GoalLog[]; penalties: PenaltyLog[]; playerStats: SummaryPlayerStats[] };
    away: { goals: GoalLog[]; penalties: PenaltyLog[]; playerStats: SummaryPlayerStats[] };
  }>;
  shootout?: ShootoutState;
}
// --- Fin de Modelos de Datos ---


const SummaryPageContent = ({ state, dispatch, toast }: { state: GameState, dispatch: React.Dispatch<any>, toast: any }) => {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [overwriteConfirm, setOverwriteConfirm] = useState<{ onConfirm: () => void } | null>(null);
  const [isEditingShots, setIsEditingShots] = useState(false);
  const [editedShots, setEditedShots] = useState<Record<string, Record<string, string>>>({});

  const [isAddPenaltyDialogOpen, setIsAddPenaltyDialogOpen] = useState(false);
  const [addPenaltyContext, setAddPenaltyContext] = useState<{team: Team, period: string} | null>(null);

  const generateSummaryData = useCallback(() => {
    setSummaryData(null);
    const { live, config } = state;
    if (!live || !config) return;

    const { gameSummary, shootout } = live;

    const statsByPeriod: SummaryData['statsByPeriod'] = {};
    
    const playedPeriodTexts = new Set<string>();
    [...gameSummary.home.goals, ...gameSummary.away.goals, ...gameSummary.home.penalties, ...gameSummary.away.penalties].forEach(event => {
        const periodText = (event as GoalLog).periodText || (event as PenaltyLog).addPeriodText;
        if (periodText && !periodText.toLowerCase().includes('warm-up') && !periodText.toLowerCase().includes('break')) {
             playedPeriodTexts.add(periodText);
        }
    });

    const allPeriodTexts = Array.from(playedPeriodTexts).sort((a, b) => {
        const getPeriodNumber = (text: string) => {
            if (text.startsWith('OT')) return (config.numberOfRegularPeriods || 2) + parseInt(text.replace('OT', '') || '1', 10);
            return parseInt(text.replace(/\D/g, ''), 10);
        };
        return getPeriodNumber(a) - getPeriodNumber(b);
    });

    allPeriodTexts.forEach(period => {
        statsByPeriod[period] = { home: { goals: [], penalties: [], playerStats: [] }, away: { goals: [], penalties: [], playerStats: [] } };
        ['home', 'away'].forEach(team => {
            const teamKey = team as Team;
            const teamGoals = gameSummary[teamKey].goals.filter(g => g.periodText === period);
            const teamPenalties = gameSummary[teamKey].penalties.filter(p => p.addPeriodText === period);

            const teamShotsInPeriod = (gameSummary[teamKey][`${teamKey}ShotsLog`] || []).filter(s => s.periodText === period);

            const playerStatsForPeriod = (gameSummary.attendance[teamKey] || []).map(attendedPlayer => {
                const goals = teamGoals.filter(g => g.scorer?.playerNumber === attendedPlayer.number).length;
                const assists = teamGoals.filter(g => g.assist?.playerNumber === attendedPlayer.number).length;
                const shots = teamShotsInPeriod.filter(s => s.playerId === attendedPlayer.id).length;
                return { id: attendedPlayer.id, number: attendedPlayer.number, name: attendedPlayer.name, shots, goals, assists };
            });

            statsByPeriod[period][teamKey] = { goals: teamGoals, penalties: teamPenalties, playerStats: playerStatsForPeriod };
        });
    });

    const selectedTournament = config.tournaments.find(t => t.id === config.selectedTournamentId);
    
    const newSummaryData: SummaryData = {
        homeTeamName: live.homeTeamName,
        awayTeamName: live.awayTeamName,
        homeScore: live.score.home,
        awayScore: live.score.away,
        categoryName: getCategoryNameById(config.selectedMatchCategory, selectedTournament?.categories || []) || 'N/A',
        statsByPeriod,
        shootout: shootout.isActive ? shootout : undefined,
    };
    setSummaryData(newSummaryData);

    if (live.matchId) {
        dispatch({ type: 'SAVE_MATCH_SUMMARY', payload: { matchId: live.matchId, summary: gameSummary } });
        toast({ title: "Resumen Guardado", description: "El resumen del partido se ha guardado automáticamente." });
    } else {
        toast({ title: "Resumen Generado", description: "Se han cargado los datos del partido actual." });
    }
  }, [state, toast, dispatch]);

  const handleGenerateSummaryClick = () => {
    if (summaryData) {
      setOverwriteConfirm({ onConfirm: generateSummaryData });
    } else {
      generateSummaryData();
    }
  };

  const homeAggregatedStats = useMemo(() => {
    return {
      goals: state.live.gameSummary.home.goals.sort((a, b) => a.timestamp - b.timestamp),
      penalties: state.live.gameSummary.home.penalties.sort((a, b) => a.addTimestamp - b.addTimestamp),
      playerStats: state.live.gameSummary.home.playerStats,
    }
  }, [state.live.gameSummary.home]);

  const awayAggregatedStats = useMemo(() => {
    return {
      goals: state.live.gameSummary.away.goals.sort((a, b) => a.timestamp - b.timestamp),
      penalties: state.live.gameSummary.away.penalties.sort((a, b) => a.addTimestamp - b.addTimestamp),
      playerStats: state.live.gameSummary.away.playerStats,
    }
  }, [state.live.gameSummary.away]);

  const allPeriodTexts = useMemo(() => {
    if (!summaryData?.statsByPeriod) return [];
    return Object.keys(summaryData.statsByPeriod);
  }, [summaryData]);
  
  const handleEditShotsClick = () => {
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
    setIsEditingShots(true);
  };
  
  const handleSaveShotsClick = () => {
    if (!summaryData) return;
    
    Object.entries(editedShots).forEach(([periodText, playerShots]) => {
      Object.entries(playerShots).forEach(([playerId, shotCountStr]) => {
        const shotCount = parseInt(shotCountStr, 10);
        if(!isNaN(shotCount)) {
            const team = state.live.gameSummary.home.playerStats.some(p => p.id === playerId) ? 'home' : 'away';
             dispatch({ type: 'SET_PLAYER_SHOTS', payload: { team, playerId, periodText, shotCount } });
        }
      })
    });

    toast({ title: "Tiros Actualizados", description: "Los cambios se han guardado."});
    setIsEditingShots(false);
  };

  const handleAddPenalty = (team: Team, period: string) => {
    setAddPenaltyContext({ team, period });
    setIsAddPenaltyDialogOpen(true);
  };

  const handleDeletePenalty = (team: Team, logId: string) => {
    dispatch({ type: 'DELETE_PENALTY_LOG', payload: { team, logId } });
  };
  
  const handleShotInputChange = (period: string, playerId: string, value: string) => {
    setEditedShots(prev => ({
        ...prev,
        [period]: {
            ...prev[period],
            [playerId]: value
        }
    }));
  };

  const handleSaveNewPenalty = (team: Team, playerNumber: string, penaltyTypeId: string, gameTimeCs?: number, periodText?: string) => {
    if (!gameTimeCs || !periodText) {
       toast({ title: "Error", description: "El tiempo y el período son requeridos para añadir una penalidad desde el resumen.", variant: "destructive"});
       return;
    }
    dispatch({ type: 'ADD_PENALTY', payload: { team, penalty: { playerNumber, penaltyTypeId }, addGameTime: gameTimeCs, addPeriodText: periodText }});
    toast({ title: "Penalidad Añadida", description: "La penalidad se ha añadido al resumen."});
    setIsAddPenaltyDialogOpen(false);
  };

  if (state.isLoading) {
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
            <Button onClick={handleGenerateSummaryClick} variant="outline"><RefreshCw className="mr-2 h-4 w-4"/> Recargar Datos del Partido</Button>
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
                                     <PenaltiesSection team="home" teamName={summaryData.homeTeamName} penalties={homeAggregatedStats.penalties} onAdd={() => handleAddPenalty('home', 'general')} onDelete={(logId) => handleDeletePenalty('home', logId)} />
                                     <PenaltiesSection team="away" teamName={summaryData.awayTeamName} penalties={awayAggregatedStats.penalties} onAdd={() => handleAddPenalty('away', 'general')} onDelete={(logId) => handleDeletePenalty('away', logId)}/>
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
                        {allPeriodTexts.length > 0 ? (
                           <Accordion type="single" collapsible className="w-full">
                                {allPeriodTexts.map(periodText => {
                                    const periodStats = summaryData.statsByPeriod![periodText];
                                    return (
                                        <AccordionItem value={periodText} key={periodText}>
                                            <AccordionTrigger className="text-xl hover:no-underline">{periodText}</AccordionTrigger>
                                            <AccordionContent className="space-y-6 pl-2">
                                                <div className="flex justify-end pr-2">
                                                {isEditingShots ? (
                                                    <div className="flex gap-2">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" onClick={handleSaveShotsClick}><Check className="h-5 w-5" /></Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setIsEditingShots(false)}><XCircle className="h-5 w-5" /></Button>
                                                    </div>
                                                ) : (
                                                    <Button variant="outline" size="sm" onClick={handleEditShotsClick}>
                                                        <Edit3 className="mr-2 h-4 w-4"/>Editar Tiros
                                                    </Button>
                                                )}
                                                </div>
                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <GoalsSection teamName={summaryData.homeTeamName} goals={periodStats.home.goals} />
                                                    <GoalsSection teamName={summaryData.awayTeamName} goals={periodStats.away.goals} />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <PenaltiesSection team="home" teamName={summaryData.homeTeamName} penalties={periodStats.home.penalties} onAdd={() => handleAddPenalty('home', periodText)} onDelete={(logId) => handleDeletePenalty('home', logId)} />
                                                    <PenaltiesSection team="away" teamName={summaryData.awayTeamName} penalties={periodStats.away.penalties} onAdd={() => handleAddPenalty('away', periodText)} onDelete={(logId) => handleDeletePenalty('away', logId)} />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                     <PlayerStatsSection teamName={summaryData.homeTeamName} playerStats={periodStats.home.playerStats} editable={isEditingShots} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
                                                     <PlayerStatsSection teamName={summaryData.awayTeamName} playerStats={periodStats.away.playerStats} editable={isEditingShots} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    )
                                })}
                           </Accordion>
                        ) : (
                            <p className="text-center text-muted-foreground py-10">No hay datos por período para mostrar.</p>
                        )}
                    </TabsContent>
                </Tabs>
            </>
        )}
        
        {overwriteConfirm && (
            <AlertDialog open={!!overwriteConfirm} onOpenChange={() => setOverwriteConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" /> Confirmar Recarga de Datos</AlertDialogTitle>
                      <AlertDialogDescription>
                        Ya existe un resumen generado. Si continúas, se perderán todos los cambios manuales que hayas hecho en este resumen. ¿Deseas continuar y reemplazar los datos?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setOverwriteConfirm(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { overwriteConfirm.onConfirm(); setOverwriteConfirm(null); }}>
                            Sí, Recargar Datos
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
        {isAddPenaltyDialogOpen && addPenaltyContext && (
            <Dialog open={isAddPenaltyDialogOpen} onOpenChange={setIsAddPenaltyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Añadir Penalidad al Resumen</DialogTitle>
                    </DialogHeader>
                    <AddPenaltyForm
                        homeTeamName={summaryData?.homeTeamName || 'Local'}
                        awayTeamName={summaryData?.awayTeamName || 'Visitante'}
                        penaltyTypes={state.config.penaltyTypes || []}
                        defaultPenaltyTypeId={state.config.defaultPenaltyTypeId}
                        onPenaltySent={(team, playerNumber, penaltyTypeId, gameTimeCs, periodText) => handleSaveNewPenalty(team, playerNumber, penaltyTypeId, gameTimeCs, periodText)}
                        preselectedTeam={addPenaltyContext.team}
                        showTimeInput={true}
                        availablePeriods={allPeriodTexts}
                        preselectedPeriod={addPenaltyContext.period !== 'general' ? addPenaltyContext.period : undefined}
                    />
                </DialogContent>
            </Dialog>
        )}
    </div>
  );
};

export default function ResumenPage() {
    const { state, dispatch, isLoading } = useGameState();
    const { toast } = useToast();

    if (isLoading) {
        return (
            <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
                <HockeyPuckSpinner className="h-24 w-24 text-primary mb-4" />
                <p className="text-xl text-foreground">Cargando...</p>
            </div>
        );
    }

    return <SummaryPageContent state={state} dispatch={dispatch} toast={toast} />;
}
