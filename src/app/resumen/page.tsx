
"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useGameState, getCategoryNameById, type GameState } from "@/contexts/game-state-context";
import type { SummaryPlayerStats, GameSummary, ShootoutState, CategoryData, TeamData, MatchData, GoalLog, PenaltyLog, Team } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Info, RefreshCw, AlertTriangle, Edit3, Check, XCircle, FileText, FileDown, PlusCircle } from "lucide-react";
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
  homeGoals: GoalLog[];
  awayGoals: GoalLog[];
  homePenalties: PenaltyLog[];
  awayPenalties: PenaltyLog[];
  homeAggregatedStats: SummaryPlayerStats[];
  awayAggregatedStats: SummaryPlayerStats[];
  shootout?: ShootoutState;
  allPeriodTexts: string[];
}
// --- Fin de Modelos de Datos ---


const SummaryPageContent = ({ state, dispatch, toast }: { state: GameState, dispatch: React.Dispatch<any>, toast: any }) => {
    const [isEditingShots, setIsEditingShots] = useState(false);
    const [editedShots, setEditedShots] = useState<Record<string, Record<string, string>>>({});
    
    const [isAddPenaltyDialogOpen, setIsAddPenaltyDialogOpen] = useState(false);
    const [addPenaltyContext, setAddPenaltyContext] = useState<{team: Team, period: string} | null>(null);

    const summaryData = useMemo((): SummaryData | null => {
        const { live, config } = state;
        if (!live || !config) return null;

        const { gameSummary, shootout, score } = live;

        const allPeriodTexts = Array.from(new Set(
            [
                ...(gameSummary.home.goals || []),
                ...(gameSummary.away.goals || []),
                ...(gameSummary.home.penalties || []),
                ...(gameSummary.away.penalties || []),
            ].map(event => event.periodText || event.addPeriodText).filter(Boolean)
        )).sort((a, b) => {
            const getPeriodNumber = (text: string) => {
                if (text.startsWith('OT')) return (config.numberOfRegularPeriods || 2) + parseInt(text.replace('OT', '') || '1', 10);
                return parseInt(text.replace(/\D/g, ''), 10);
            };
            return getPeriodNumber(a) - getPeriodNumber(b);
        });

        const selectedTournament = (config.tournaments || []).find(t => t.id === config.selectedTournamentId);

        return {
            homeTeamName: live.homeTeamName,
            awayTeamName: live.awayTeamName,
            homeScore: score.home,
            awayScore: score.away,
            categoryName: getCategoryNameById(config.selectedMatchCategory, selectedTournament?.categories || []) || 'N/A',
            homeGoals: [...(gameSummary.home.goals || [])].sort((a, b) => a.timestamp - b.timestamp),
            awayGoals: [...(gameSummary.away.goals || [])].sort((a, b) => a.timestamp - b.timestamp),
            homePenalties: [...(gameSummary.home.penalties || [])].sort((a, b) => a.addTimestamp - b.addTimestamp),
            awayPenalties: [...(gameSummary.away.penalties || [])].sort((a, b) => a.addTimestamp - b.addTimestamp),
            homeAggregatedStats: gameSummary.home.playerStats || [],
            awayAggregatedStats: gameSummary.away.playerStats || [],
            shootout: shootout.isActive ? shootout : undefined,
            allPeriodTexts,
        };
    }, [state]);

    const handleEditShotsClick = () => {
        const { gameSummary } = state.live;
        if (!summaryData || !gameSummary) return;

        const initialShots: Record<string, Record<string, string>> = {};
        
        summaryData.allPeriodTexts.forEach(period => {
            initialShots[period] = {};
            ['home', 'away'].forEach(teamStr => {
                const team = teamStr as Team;
                const attendance = gameSummary.attendance[team] || [];
                const shotsLog = team === 'home' ? gameSummary.home.homeShotsLog : gameSummary.away.awayShotsLog;

                attendance.forEach(player => {
                    const shotCount = (shotsLog || []).filter(s => s.playerId === player.id && s.periodText === period).length;
                    initialShots[period][player.id] = String(shotCount);
                });
            });
        });

        setEditedShots(initialShots);
        setIsEditingShots(true);
    };

    const handleSaveShotsClick = () => {
        let hasChanges = false;
        const { gameSummary } = state.live;

        Object.entries(editedShots).forEach(([periodText, playerShots]) => {
            Object.entries(playerShots).forEach(([playerId, shotCountStr]) => {
                const shotCount = parseInt(shotCountStr, 10);
                if (!isNaN(shotCount)) {
                    const team = gameSummary.attendance.home.some(p => p.id === playerId) ? 'home' : 'away';
                    const shotsLog = team === 'home' ? gameSummary.home.homeShotsLog : gameSummary.away.awayShotsLog;
                    const originalShotCount = (shotsLog || []).filter(s => s.playerId === playerId && s.periodText === periodText).length;

                    if (shotCount !== originalShotCount) {
                        hasChanges = true;
                        dispatch({ type: 'SET_PLAYER_SHOTS', payload: { team, playerId, periodText, shotCount } });
                    }
                }
            });
        });

        if (hasChanges) {
            toast({ title: "Tiros Actualizados", description: "Los cambios se han guardado." });
        } else {
            toast({ title: "Sin Cambios", description: "No se detectaron modificaciones en los tiros." });
        }
        setIsEditingShots(false);
    };
    
    const handleShotInputChange = (period: string, playerId: string, value: string) => {
        if (/^\d*$/.test(value)) {
            setEditedShots(prev => ({
                ...prev,
                [period]: {
                    ...prev[period],
                    [playerId]: value,
                }
            }));
        }
    };
    
    const handleAddPenalty = (team: Team, period: string) => {
        setAddPenaltyContext({ team, period });
        setIsAddPenaltyDialogOpen(true);
    };

    const handleDeletePenalty = (team: Team, logId: string) => {
        dispatch({ type: 'DELETE_PENALTY_LOG', payload: { team, logId } });
    };

    const handleSaveNewPenalty = (team: Team, playerNumber: string, penaltyTypeId: string, gameTimeCs?: number, periodText?: string) => {
        if (!gameTimeCs || !periodText) {
            toast({ title: "Error", description: "El tiempo y el período son requeridos para añadir una penalidad desde el resumen.", variant: "destructive"});
            return;
        }
        dispatch({ type: 'ADD_PENALTY', payload: { team, penalty: { playerNumber, penaltyTypeId }, addGameTime: gameTimeCs, addPeriodText: periodText } });
        toast({ title: "Penalidad Añadida", description: "La penalidad se ha añadido al resumen."});
        setIsAddPenaltyDialogOpen(false);
    };

    if (state.isLoading || !summaryData) {
        return (
            <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
                <HockeyPuckSpinner className="h-24 w-24 text-primary mb-4" />
                <p className="text-xl text-foreground">Cargando Resumen...</p>
            </div>
        );
    }
  
    return (
        <div className="w-full max-w-6xl mx-auto space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4">
                <h1 className="text-3xl font-bold text-primary-foreground">Resumen del Partido</h1>
            </div>
            
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
                                <GoalsSection teamName={summaryData.homeTeamName} goals={summaryData.homeGoals} />
                                <GoalsSection teamName={summaryData.awayTeamName} goals={summaryData.awayGoals} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <PenaltiesSection team="home" teamName={summaryData.homeTeamName} penalties={summaryData.homePenalties} onAdd={() => handleAddPenalty('home', 'general')} onDelete={(logId) => handleDeletePenalty('home', logId)} />
                                <PenaltiesSection team="away" teamName={summaryData.awayTeamName} penalties={summaryData.awayPenalties} onAdd={() => handleAddPenalty('away', 'general')} onDelete={(logId) => handleDeletePenalty('away', logId)} />
                            </div>
                            
                            {summaryData.shootout && (summaryData.shootout.homeAttempts.length > 0 || summaryData.shootout.awayAttempts.length > 0) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <ShootoutSection teamName={summaryData.homeTeamName} attempts={summaryData.shootout.homeAttempts} />
                                    <ShootoutSection teamName={summaryData.awayTeamName} attempts={summaryData.shootout.awayAttempts} />
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <PlayerStatsSection teamName={summaryData.homeTeamName} playerStats={summaryData.homeAggregatedStats} />
                                <PlayerStatsSection teamName={summaryData.awayTeamName} playerStats={summaryData.awayAggregatedStats} />
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="periods" className="mt-6">
                    {summaryData.allPeriodTexts.length > 0 ? (
                       <Accordion type="single" collapsible className="w-full">
                            {summaryData.allPeriodTexts.map(periodText => {
                                const homeGoalsInPeriod = summaryData.homeGoals.filter(g => g.periodText === periodText);
                                const awayGoalsInPeriod = summaryData.awayGoals.filter(g => g.periodText === periodText);
                                const homePenaltiesInPeriod = summaryData.homePenalties.filter(p => p.addPeriodText === periodText);
                                const awayPenaltiesInPeriod = summaryData.awayPenalties.filter(p => p.addPeriodText === periodText);
                                
                                const homePlayerStatsInPeriod = summaryData.homeAggregatedStats.map(p => ({ ...p, shots: state.live.gameSummary.home.homeShotsLog.filter(s => s.playerId === p.id && s.periodText === periodText).length, goals: homeGoalsInPeriod.filter(g => g.scorer?.playerNumber === p.number).length, assists: homeGoalsInPeriod.filter(g => g.assist?.playerNumber === p.number).length }));
                                const awayPlayerStatsInPeriod = summaryData.awayAggregatedStats.map(p => ({ ...p, shots: state.live.gameSummary.away.awayShotsLog.filter(s => s.playerId === p.id && s.periodText === periodText).length, goals: awayGoalsInPeriod.filter(g => g.scorer?.playerNumber === p.number).length, assists: awayGoalsInPeriod.filter(g => g.assist?.playerNumber === p.number).length }));
                                
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
                                                <GoalsSection teamName={summaryData.homeTeamName} goals={homeGoalsInPeriod} />
                                                <GoalsSection teamName={summaryData.awayTeamName} goals={awayGoalsInPeriod} />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <PenaltiesSection team="home" teamName={summaryData.homeTeamName} penalties={homePenaltiesInPeriod} onAdd={() => handleAddPenalty('home', periodText)} onDelete={(logId) => handleDeletePenalty('home', logId)} />
                                                <PenaltiesSection team="away" teamName={summaryData.awayTeamName} penalties={awayPenaltiesInPeriod} onAdd={() => handleAddPenalty('away', periodText)} onDelete={(logId) => handleDeletePenalty('away', logId)} />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <PlayerStatsSection teamName={summaryData.homeTeamName} playerStats={homePlayerStatsInPeriod} editable={isEditingShots} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
                                                <PlayerStatsSection teamName={summaryData.awayTeamName} playerStats={awayPlayerStatsInPeriod} editable={isEditingShots} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
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
                            availablePeriods={summaryData.allPeriodTexts}
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

    