
"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useGameState, getCategoryNameById, type GameState, generateSummaryData } from "@/contexts/game-state-context";
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
  statsByPeriod?: Record<string, any>;
}
// --- Fin de Modelos de Datos ---


const SummaryPageContent = ({ state, dispatch, toast }: { state: GameState, dispatch: React.Dispatch<any>, toast: any }) => {
    const [isEditingShots, setIsEditingShots] = useState(false);
    const [editedShots, setEditedShots] = useState<Record<string, Record<string, string>>>({});
    
    const [isAddPenaltyDialogOpen, setIsAddPenaltyDialogOpen] = useState(false);
    const [addPenaltyContext, setAddPenaltyContext] = useState<{team: Team, period: string} | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const summaryData = useMemo(() => {
        return generateSummaryData(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.live.gameSummary, refreshKey]);

    const homeAggregatedStats = useMemo(() => {
        if (!summaryData) return [];
        return summaryData.homeAggregatedStats;
    }, [summaryData]);

    const awayAggregatedStats = useMemo(() => {
        if (!summaryData) return [];
        return summaryData.awayAggregatedStats;
    }, [summaryData]);


    const handleEditShotsClick = () => {
        if (!summaryData?.statsByPeriod) return;

        const initialShots: Record<string, Record<string, string>> = {};
        
        for(const periodText of summaryData.allPeriodTexts) {
            initialShots[periodText] = {};
            const periodStats = summaryData.statsByPeriod[periodText];
            if (periodStats) {
                ['home', 'away'].forEach(teamStr => {
                    const team = teamStr as Team;
                    const playerStats = periodStats[team]?.playerStats || [];
                    playerStats.forEach((p: SummaryPlayerStats) => {
                        initialShots[periodText][p.id] = String(p.shots || 0);
                    });
                });
            }
        }
        setEditedShots(initialShots);
        setIsEditingShots(true);
    };

    const handleSaveShotsClick = () => {
        let hasChanges = false;
        
        Object.entries(editedShots).forEach(([periodText, playerShots]) => {
            Object.entries(playerShots).forEach(([playerId, shotCountStr]) => {
                const shotCount = parseInt(shotCountStr, 10);
                if (!isNaN(shotCount)) {
                    const team = state.live.gameSummary.attendance.home.some(p => p.id === playerId) ? 'home' : 'away';
                    const originalShotCount = (state.live.gameSummary[`${team}ShotsLog` as const] || []).filter(s => s.playerId === playerId && s.periodText === periodText).length || 0;
                    
                    if (shotCount !== originalShotCount) {
                        hasChanges = true;
                        dispatch({ type: 'SET_PLAYER_SHOTS', payload: { team, playerId, periodText, shotCount } });
                    }
                }
            });
        });

        if (hasChanges) {
            setRefreshKey(k => k + 1);
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
            <div className="flex flex-col justify-center items-center min-h-[calc(100vh-20rem)] text-center p-4">
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
                                <PlayerStatsSection teamName={summaryData.homeTeamName} playerStats={homeAggregatedStats} />
                                <PlayerStatsSection teamName={summaryData.awayTeamName} playerStats={awayAggregatedStats} />
                            </div>
                        </div>
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="periods" className="mt-6">
                    {summaryData.allPeriodTexts && summaryData.allPeriodTexts.length > 0 ? (
                       <Accordion type="single" collapsible className="w-full">
                            <AccordionItem value="periods-details">
                                <AccordionTrigger className="text-xl flex-grow hover:no-underline">
                                    Detalle por Período
                                </AccordionTrigger>
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
                                    {summaryData.allPeriodTexts.map(periodText => {
                                        const periodStats = summaryData.statsByPeriod?.[periodText];
                                        if(!periodStats) return null;

                                        return (
                                            <div key={periodText} className="space-y-4 border-l-2 pl-4 ml-2">
                                                <h3 className="text-lg font-semibold">{periodText}</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <PlayerStatsSection teamName={summaryData.homeTeamName} playerStats={periodStats.home.playerStats} editable={isEditingShots} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
                                                    <PlayerStatsSection teamName={summaryData.awayTeamName} playerStats={periodStats.away.playerStats} editable={isEditingShots} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </AccordionContent>
                            </AccordionItem>
                       </Accordion>
                    ) : (
                        <p className="text-center text-muted-foreground py-10">No hay datos por período para mostrar.</p>
                    )}
                </TabsContent>
            </Tabs>
        
            {isAddPenaltyDialogOpen && addPenaltyContext && (
                <Dialog open={isAddPenaltyDialogOpen} onOpenChange={setIsAddPenaltyDialogOpen}>
                    <DialogHeader>
                        <DialogTitle>Añadir Penalidad al Resumen</DialogTitle>
                        <DialogDescription>Añade una penalidad que ocurrió durante el partido pero no fue registrada en vivo.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
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
                    </div>
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
    
    if (!state.live.gameSummary || (!state.live.gameSummary.home.goals.length && !state.live.gameSummary.away.goals.length && !state.live.gameSummary.home.penalties.length && !state.live.gameSummary.away.penalties.length)) {
       return (
            <div className="w-full max-w-6xl mx-auto space-y-6 text-center">
                 <h1 className="text-3xl font-bold text-primary-foreground">Resumen del Partido</h1>
                 <div className="py-20 border-2 border-dashed rounded-lg">
                    <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold">No hay resumen para mostrar.</h3>
                    <p className="text-muted-foreground">Finaliza un partido para ver su resumen aquí.</p>
                 </div>
            </div>
       )
    }

    return <SummaryPageContent state={state} dispatch={dispatch} toast={toast} />;
}
