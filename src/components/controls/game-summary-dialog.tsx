
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useGameState, formatTime, type Team, type GoalLog, type PenaltyLog, getCategoryNameById, getEndReasonText, type ShotLog, type AttendedPlayerInfo, getPeriodText } from "@/contexts/game-state-context";
import type { PlayerData, SummaryPlayerStats } from '@/types';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Goal, Siren, X, FileText, FileDown, BarChart3, Edit3, Check, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportGameSummaryPDF } from "@/lib/pdf-generator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../ui/accordion";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { GoalsSection } from "../summary/goals-section";
import { PenaltiesSection } from "../summary/penalties-section";
import { PlayerStatsSection } from "../summary/player-stats-section";

interface GameSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const EditableShotCell = ({ team, periodText, player, onSave }: { team: Team, periodText: string, player: PlayerData & { shots: number }, onSave: () => void }) => {
    const { dispatch } = useGameState();
    const [isEditing, setIsEditing] = useState(false);
    const [shotValue, setShotValue] = useState(String(player.shots));
    const { toast } = useToast();

    useEffect(() => {
        setShotValue(String(player.shots));
    }, [player.shots]);

    const handleSave = () => {
        const newShotCount = parseInt(shotValue, 10);
        if (isNaN(newShotCount) || newShotCount < 0) {
            toast({ title: "Valor inválido", description: "El número de tiros debe ser un número positivo.", variant: "destructive" });
            return;
        }

        dispatch({
            type: 'SET_PLAYER_SHOTS',
            payload: {
                team,
                playerId: player.id,
                periodText,
                shotCount: newShotCount
            }
        });
        toast({ title: "Tiros actualizados", description: `Tiros para #${player.number} en ${periodText} establecidos a ${newShotCount}.` });
        setIsEditing(false);
        onSave();
    };

    if (isEditing) {
        return (
            <div className="flex items-center gap-1 justify-center">
                <Input
                    type="number"
                    value={shotValue}
                    onChange={(e) => setShotValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                    className="h-7 w-14 text-center"
                    autoFocus
                />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500" onClick={handleSave}><Check className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setIsEditing(false)}><XCircle className="h-4 w-4" /></Button>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center gap-1">
            <span className="font-mono">{player.shots || 0}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground opacity-50 hover:opacity-100" onClick={() => setIsEditing(true)}>
                <Edit3 className="h-3 w-3" />
            </Button>
        </div>
    );
};


export function GameSummaryDialog({ isOpen, onOpenChange }: GameSummaryDialogProps) {
  const { state } = useGameState();
  const { toast } = useToast();
  
  // This state is to force a re-render of the general stats when per-period stats are edited.
  const [refreshKey, setRefreshKey] = useState(0);
  
  const selectedTournament = useMemo(() => (state.config.tournaments || []).find(t => t.id === state.config.selectedTournamentId), [state.config.tournaments, state.config.selectedTournamentId]);
  
  const { homeTeam, awayTeam } = useMemo(() => {
    if (!selectedTournament) return { homeTeam: null, awayTeam: null };
    const home = selectedTournament.teams.find(t => t.name === state.live.homeTeamName && (t.subName || undefined) === (state.live.homeTeamSubName || undefined) && t.category === state.config.selectedMatchCategory);
    const away = selectedTournament.teams.find(t => t.name === state.live.awayTeamName && (t.subName || undefined) === (state.live.awayTeamSubName || undefined) && t.category === state.config.selectedMatchCategory);
    return { homeTeam: home, awayTeam: away };
  }, [selectedTournament, state.live.homeTeamName, state.live.awayTeamName, state.live.homeTeamSubName, state.live.awayTeamSubName, state.config.selectedMatchCategory]);


  const allHomeGoals = useMemo(() => {
    if (!state.live.score) return [];
    return [...(state.live.score.homeGoals || [])].sort((a, b) => a.timestamp - b.timestamp);
  }, [state.live.score, refreshKey]);
  
  const allAwayGoals = useMemo(() => {
    if (!state.live.score) return [];
    return [...(state.live.score.awayGoals || [])].sort((a, b) => a.timestamp - b.timestamp);
  }, [state.live.score, refreshKey]);
  
  const allHomePenalties = useMemo(() => {
      if (!state.live.gameSummary.home) return [];
      return [...state.live.gameSummary.home.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp);
  }, [state.live.gameSummary.home, refreshKey]);

  const allAwayPenalties = useMemo(() => {
      if (!state.live.gameSummary.away) return [];
      return [...state.live.gameSummary.away.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp);
  }, [state.live.gameSummary.away, refreshKey]);
  
  const allPeriodTexts = useMemo(() => {
    if (!state.config) return [];
    const playedPeriods = new Set<string>();
    
    // Iterate through all periods defined in the game format
    const totalPeriods = state.config.numberOfRegularPeriods + state.config.numberOfOvertimePeriods;
    const lastPlayedPeriodNumber = state.live.clock.currentPeriod;
    
    for (let i = 1; i <= lastPlayedPeriodNumber && i <= totalPeriods; i++) {
        const periodText = getPeriodText(i, state.config.numberOfRegularPeriods);
        playedPeriods.add(periodText);
    }
    
    // Ensure all periods with events are included, even if game ends early
    [...allHomeGoals, ...allAwayGoals, ...allHomePenalties, ...allAwayPenalties].forEach(event => {
        const period = event.periodText || event.addPeriodText;
        if (period && !period.toLowerCase().includes('warm-up') && !period.toLowerCase().includes('break')) {
            playedPeriods.add(period);
        }
    });

    const sortedPeriods = Array.from(playedPeriods);

    return sortedPeriods.sort((a, b) => {
        const getPeriodNumber = (text: string) => {
            if (text.startsWith('OT')) return (state.config?.numberOfRegularPeriods || 2) + parseInt(text.replace('OT', ''), 10);
            return parseInt(text.replace(/\\D/g, ''), 10);
        };
        return getPeriodNumber(a) - getPeriodNumber(b);
    });
  }, [allHomeGoals, allAwayGoals, allHomePenalties, allAwayPenalties, state.config, state.live.clock.currentPeriod]);


  const escapeCsvCell = (cellData: any): string => {
    const stringData = String(cellData ?? '');
    if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\\n')) {
        return `"${stringData.replace(/"/g, '""')}"`;
    }
    return stringData;
  };

  const handleExportCSV = () => {
    const headers = ['Equipo', 'Tipo', 'Tiempo Juego', 'Periodo', '# Jugador', 'Nombre', '# Jugador 2', 'Nombre 2', 'Duración Pen.', 'Estado Pen.'];
    const rows: string[][] = [];

    allHomeGoals.forEach(g => rows.push([state.live.homeTeamName, 'Gol', formatTime(g.gameTime), g.periodText, g.scorer?.playerNumber || 'S/N', g.scorer?.playerName || '---', g.assist?.playerNumber || '', g.assist?.playerName || '', '', '']));
    allAwayGoals.forEach(g => rows.push([state.live.awayTeamName, 'Gol', formatTime(g.gameTime), g.periodText, g.scorer?.playerNumber || 'S/N', g.scorer?.playerName || '---', g.assist?.playerNumber || '', g.assist?.playerName || '', '', '']));
    allHomePenalties.forEach(p => rows.push([state.live.homeTeamName, 'Penalidad', formatTime(p.addGameTime), p.addPeriodText, p.playerNumber, p.playerName || '---', '', '', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason) ]));
    allAwayPenalties.forEach(p => rows.push([state.live.awayTeamName, 'Penalidad', formatTime(p.addGameTime), p.addPeriodText, p.playerNumber, p.playerName || '---', '', '', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason) ]));

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.map(escapeCsvCell).join(','), ...rows.map(row => row.map(escapeCsvCell).join(','))].join('\\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `resumen_partido_${state.live.homeTeamName}_vs_${state.live.awayTeamName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleExportPDF = () => {
    const filename = exportGameSummaryPDF(state);
    toast({
        title: "Resumen Descargado",
        description: `El archivo ${filename} se ha guardado.`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-3xl">Resumen del Partido</DialogTitle>
          <DialogDescription>
            Un resumen completo de los goles y penalidades del partido actual.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 text-center my-2">
            <h3 className="text-2xl font-bold text-primary">{state.live.homeTeamName} - <span className="text-accent">{state.live.score.home}</span></h3>
            <h3 className="text-2xl font-bold text-primary">{state.live.awayTeamName} - <span className="text-accent">{state.live.score.away}</span></h3>
        </div>

        <ScrollArea className="flex-grow my-4 border-y py-4 pr-6 -mr-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <GoalsSection team="home" teamName={state.live.homeTeamName} goals={allHomeGoals} />
              <GoalsSection team="away" teamName={state.live.awayTeamName} goals={allAwayGoals} />
            </div>

            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PenaltiesSection team="home" teamName={state.live.homeTeamName} penalties={allHomePenalties} />
              <PenaltiesSection team="away" teamName={state.live.awayTeamName} penalties={allAwayPenalties} />
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PlayerStatsSection key={`home-total-${refreshKey}`} teamName={state.live.homeTeamName} playerStats={state.live.gameSummary.home.playerStats} allPlayers={homeTeam?.players} attendance={state.live.gameSummary.attendance.home} />
                <PlayerStatsSection key={`away-total-${refreshKey}`} teamName={state.live.awayTeamName} playerStats={state.live.gameSummary.away.playerStats} allPlayers={awayTeam?.players} attendance={state.live.gameSummary.attendance.away} />
            </div>

            <Separator />

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-xl text-primary-foreground hover:no-underline">
                  Estadísticas por Periodo
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-8 pl-2">
                    {allPeriodTexts.map(periodText => {
                       const homeGoalsInPeriod = allHomeGoals.filter(g => g.periodText === periodText);
                       const awayGoalsInPeriod = allAwayGoals.filter(g => g.periodText === periodText);
                       const homeShotsInPeriod = (state.live.gameSummary.home.homeShotsLog || []).filter(s => s.periodText === periodText);
                       const awayShotsInPeriod = (state.live.gameSummary.away.awayShotsLog || []).filter(s => s.periodText === periodText);
                       
                       const homeAttendance = state.live.gameSummary.attendance.home || [];
                       const awayAttendance = state.live.gameSummary.attendance.away || [];

                        const getPlayerStatsForPeriod = (
                            goals: GoalLog[],
                            shots: ShotLog[],
                            attendance: AttendedPlayerInfo[],
                        ): SummaryPlayerStats[] => {
                             const statsMap = new Map<string, SummaryPlayerStats>();

                            // Initialize stats for all attended players
                            attendance.forEach(p => {
                                statsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 });
                            });
                            
                            goals.forEach(g => {
                                const scorerId = attendance.find(p => p.number === g.scorer?.playerNumber)?.id;
                                if (scorerId && statsMap.has(scorerId)) {
                                    statsMap.get(scorerId)!.goals++;
                                }
                                const assistId = attendance.find(p => p.number === g.assist?.playerNumber)?.id;
                                if(assistId && statsMap.has(assistId)) {
                                    statsMap.get(assistId)!.assists++;
                                }
                            });

                            shots.forEach(s => {
                                if (s.playerId && statsMap.has(s.playerId)) {
                                    statsMap.get(s.playerId)!.shots++;
                                }
                            });
                            return Array.from(statsMap.values());
                        };


                       const homePlayerStatsInPeriod = getPlayerStatsForPeriod(homeGoalsInPeriod, homeShotsInPeriod, homeAttendance);
                       const awayPlayerStatsInPeriod = getPlayerStatsForPeriod(awayGoalsInPeriod, awayShotsInPeriod, awayAttendance);

                       const homePenaltiesInPeriod = allHomePenalties.filter(p => p.addPeriodText === periodText);
                       const awayPenaltiesInPeriod = allAwayPenalties.filter(p => p.addPeriodText === periodText);

                      return (
                        <div key={periodText} className="space-y-4">
                          <h3 className="text-xl font-semibold text-center text-primary-foreground border-b pb-2 mb-4">
                            {periodText}
                          </h3>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <GoalsSection team="home" teamName={state.live.homeTeamName} goals={homeGoalsInPeriod} />
                              <GoalsSection team="away" teamName={state.live.awayTeamName} goals={awayGoalsInPeriod} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <PenaltiesSection team="home" teamName={state.live.homeTeamName} penalties={homePenaltiesInPeriod} />
                              <PenaltiesSection team="away" teamName={state.live.awayTeamName} penalties={awayPenaltiesInPeriod} />
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <PlayerStatsSection teamName={state.live.homeTeamName} allPlayers={homeTeam?.players} playerStats={homePlayerStatsInPeriod} attendance={homeAttendance} editable={true} periodText={periodText} onEdit={() => setRefreshKey(k => k + 1)} />
                              <PlayerStatsSection teamName={state.live.awayTeamName} allPlayers={awayTeam?.players} playerStats={awayPlayerStatsInPeriod} attendance={awayAttendance} editable={true} periodText={periodText} onEdit={() => setRefreshKey(k => k + 1)} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>
        <DialogFooter className="flex-wrap">
          <div className="flex-grow flex justify-start gap-2">
            <Button type="button" variant="outline" onClick={handleExportCSV}><FileText className="mr-2 h-4 w-4" />Exportar a CSV</Button>
            <Button type="button" variant="outline" onClick={handleExportPDF}><FileDown className="mr-2 h-4 w-4" />Exportar a PDF</Button>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="outline"><X className="mr-2 h-4 w-4" />Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
