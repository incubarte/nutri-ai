
"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useGameState, getCategoryNameById, type GameState } from "@/contexts/game-state-context";
import type { SummaryPlayerStats, GameSummary, ShootoutState, CategoryData, TeamData, MatchData } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, Info, RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";
import { GoalsSection } from "@/components/summary/goals-section";
import { PenaltiesSection } from "@/components/summary/penalties-section";
import { PlayerStatsSection } from "@/components/summary/player-stats-section";
import { ShootoutSection } from "@/components/summary/shootout-section";
import { getPeriodText } from "@/contexts/game-state-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Team, GoalLog, PenaltyLog } from "@/types";

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

  const generateSummaryData = useCallback(() => {
    setSummaryData(null);
    const { live, config } = state;
    if (!live || !config) return;

    const { gameSummary, shootout } = live;

    const statsByPeriod: SummaryData['statsByPeriod'] = {};
    const playedPeriodNumbers = new Set<number>();
    const lastPlayedPeriodNumber = live.clock.currentPeriod;
    if (lastPlayedPeriodNumber > 0) {
      for (let i = 1; i <= lastPlayedPeriodNumber; i++) playedPeriodNumbers.add(i);
    }
    
    [...gameSummary.home.goals, ...gameSummary.away.goals, ...gameSummary.home.penalties, ...gameSummary.away.penalties].forEach(event => {
        const periodText = (event as GoalLog).periodText || (event as PenaltyLog).addPeriodText;
        if (periodText && !periodText.toLowerCase().includes('warm-up') && !periodText.toLowerCase().includes('break')) {
             const periodNum = parseInt(periodText.replace(/\D/g, ''), 10);
             if (!isNaN(periodNum) && periodNum > 0) playedPeriodNumbers.add(periodNum);
        }
    });

    const allPeriodTexts = Array.from(playedPeriodNumbers).sort((a,b) => a-b).map(num => getPeriodText(num, config.numberOfRegularPeriods));

    allPeriodTexts.forEach(period => {
        statsByPeriod[period] = { home: { goals: [], penalties: [], playerStats: [] }, away: { goals: [], penalties: [], playerStats: [] } };
        ['home', 'away'].forEach(team => {
            const teamKey = team as Team;
            const teamGoals = gameSummary[teamKey].goals.filter(g => g.periodText === period);
            const teamPenalties = gameSummary[teamKey].penalties.filter(p => p.addPeriodText === period);
            statsByPeriod[period][teamKey] = { goals: teamGoals, penalties: teamPenalties, playerStats: [] }; // Player stats will be aggregated later
        });
    });

    const selectedTournament = config.tournaments.find(t => t.id === config.selectedTournamentId);
    
    const newSummaryData: SummaryData = {
        homeTeamName: live.homeTeamName,
        awayTeamName: live.awayTeamName,
        homeScore: live.score.home,
        awayScore: live.score.away,
        categoryName: getCategoryNameById(config.selectedMatchCategory, selectedTournament?.categories) || 'N/A',
        statsByPeriod,
        shootout: shootout.isActive ? shootout : undefined,
    };
    setSummaryData(newSummaryData);

    // Automatic Save Logic
    if (live.matchId) {
        const finalSummary: GameSummary = {
            home: { goals: live.score.homeGoals, penalties: live.gameSummary.home.penalties, playerStats: live.gameSummary.home.playerStats, homeShotsLog: live.gameSummary.home.homeShotsLog },
            away: { goals: live.score.awayGoals, penalties: live.gameSummary.away.penalties, playerStats: live.gameSummary.away.playerStats, awayShotsLog: live.gameSummary.away.awayShotsLog },
            attendance: live.gameSummary.attendance,
            shootout: live.shootout,
            statsByPeriod: newSummaryData.statsByPeriod
        };
        dispatch({ type: 'SAVE_MATCH_SUMMARY', payload: { matchId: live.matchId, summary: finalSummary } });
        toast({ title: "Resumen Guardado", description: "El resumen del partido se ha guardado automáticamente." });
    } else {
        toast({ title: "Resumen Generado", description: "Se han cargado los datos del partido actual (no se guardará sin un partido del fixture activo)." });
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
