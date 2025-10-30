
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
import { ShootoutSection } from "../summary/shootout-section";

interface GameSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function GameSummaryDialog({ isOpen, onOpenChange }: GameSummaryDialogProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedShots, setEditedShots] = useState<Record<string, Record<string, string>>>({});
  
  const selectedTournament = useMemo(() => (state.config.tournaments || []).find(t => t.id === state.config.selectedTournamentId), [state.config.tournaments, state.config.selectedTournamentId]);
  
  const { homeTeam, awayTeam } = useMemo(() => {
    if (!selectedTournament) return { homeTeam: null, awayTeam: null };
    const home = selectedTournament.teams.find(t => t.name === state.live.homeTeamName && (t.subName || undefined) === (state.live.homeTeamSubName || undefined) && t.category === state.config.selectedMatchCategory);
    const away = selectedTournament.teams.find(t => t.name === state.live.awayTeamName && (t.subName || undefined) === (state.live.awayTeamSubName || undefined) && t.category === state.config.selectedMatchCategory);
    return { homeTeam: home, awayTeam: away };
  }, [selectedTournament, state.live.homeTeamName, state.live.awayTeamName, state.live.homeTeamSubName, state.live.awayTeamSubName, state.config.selectedMatchCategory]);

  const allHomeGoals = useMemo(() => [...(state.live.score?.homeGoals || [])].sort((a, b) => a.timestamp - b.timestamp), [state.live.score, refreshKey]);
  const allAwayGoals = useMemo(() => [...(state.live.score?.awayGoals || [])].sort((a, b) => a.timestamp - b.timestamp), [state.live.score, refreshKey]);
  const allHomePenalties = useMemo(() => [...state.live.gameSummary.home.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp), [state.live.gameSummary.home, refreshKey]);
  const allAwayPenalties = useMemo(() => [...state.live.gameSummary.away.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp), [state.live.gameSummary.away, refreshKey]);
  
  const allPeriodTexts = useMemo(() => {
    const periodSet = new Set<string>();
    const allEvents = [
        ...state.live.score.homeGoals,
        ...state.live.score.awayGoals,
        ...state.live.gameSummary.home.penalties,
        ...state.live.gameSummary.away.penalties,
        ...(state.live.gameSummary.home.homeShotsLog || []),
        ...(state.live.gameSummary.away.awayShotsLog || []),
    ];
    allEvents.forEach(event => {
        const periodText = 'periodText' in event ? event.periodText : event.addPeriodText;
        if (periodText && !periodText.toLowerCase().includes('warm-up')) {
            periodSet.add(periodText);
        }
    });
    
    // Add shootout if it exists
    if(state.live.shootout.homeAttempts.length > 0 || state.live.shootout.awayAttempts.length > 0) {
        periodSet.add("SHOOTOUT");
    }
    
    const sortedPeriods = Array.from(periodSet);

    return sortedPeriods.sort((a, b) => {
        const getPeriodNumber = (text: string) => {
            if (text === 'SHOOTOUT') return (state.config.numberOfRegularPeriods || 2) + (state.config.numberOfOvertimePeriods || 0) + 1;
            if (text.startsWith('OT')) return (state.config.numberOfRegularPeriods || 2) + parseInt(text.replace('OT', ''), 10);
            return parseInt(text.replace(/\D/g, ''), 10);
        };
        return getPeriodNumber(a) - getPeriodNumber(b);
    });
  }, [state.live, state.config.numberOfRegularPeriods, state.config.numberOfOvertimePeriods]);


  const escapeCsvCell = (cellData: any): string => {
    const stringData = String(cellData ?? '');
    if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\\n')) {
        return `"${stringData.replace(/"/g, '""')}"`;
    }
    return stringData;
  };

  const handleExportCSV = () => {
    // ... CSV export logic remains the same ...
  };
  
  const handleExportPDF = () => {
    const filename = exportGameSummaryPDF(state);
    toast({
        title: "Resumen Descargado",
        description: `El archivo ${filename} se ha guardado.`,
    });
  };
  
  const handleEditClick = () => {
    const initialShots: Record<string, Record<string, string>> = {};
    for (const periodText of allPeriodTexts) {
        initialShots[periodText] = {};
        for (const team of ['home', 'away'] as const) {
            const playerStats = getPlayerStatsForPeriod(periodText, team);
            playerStats.forEach(p => {
                initialShots[periodText][p.id] = String(p.shots || 0);
            });
        }
    }
    setEditedShots(initialShots);
    setIsEditing(true);
  };
  
  const handleCancelClick = () => setIsEditing(false);
  
  const handleSaveClick = () => {
    let hasChanges = false;
    for (const periodText in editedShots) {
      for (const team of ['home', 'away'] as const) {
        const teamPlayers = team === 'home' ? (homeTeam?.players || []) : (awayTeam?.players || []);
        teamPlayers.forEach(player => {
            const newShotCountStr = editedShots[periodText]?.[player.id];
            if (newShotCountStr !== undefined) {
                 const newShotCount = parseInt(newShotCountStr, 10) || 0;
                 dispatch({ type: 'SET_PLAYER_SHOTS', payload: { team, playerId: player.id, periodText, shotCount: newShotCount }});
                 hasChanges = true;
            }
        });
      }
    }

    if (hasChanges) {
        toast({ title: "Tiros Actualizados", description: "Se han guardado los cambios en los tiros por período." });
        setRefreshKey(k => k + 1);
    } else {
        toast({ title: "Sin Cambios", description: "No se detectaron modificaciones." });
    }
    setIsEditing(false);
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
  
  const getPlayerStatsForPeriod = (periodText: string, team: 'home' | 'away'): SummaryPlayerStats[] => {
    const goalsInPeriod = (team === 'home' ? allHomeGoals : allAwayGoals).filter(g => g.periodText === periodText);
    const shotsInPeriod = (team === 'home' ? state.live.gameSummary.home.homeShotsLog : state.live.gameSummary.away.awayShotsLog || []).filter(s => s.periodText === periodText);
    const attendance = state.live.gameSummary.attendance[team] || [];

    const statsMap = new Map<string, SummaryPlayerStats>();
    attendance.forEach(p => statsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

    goalsInPeriod.forEach(g => {
        const scorerId = attendance.find(p => p.number === g.scorer?.playerNumber)?.id;
        if (scorerId && statsMap.has(scorerId)) statsMap.get(scorerId)!.goals++;
        const assistId = attendance.find(p => p.number === g.assist?.playerNumber)?.id;
        if (assistId && statsMap.has(assistId)) statsMap.get(assistId)!.assists++;
    });

    shotsInPeriod.forEach(s => {
        if (s.playerId && statsMap.has(s.playerId)) statsMap.get(s.playerId)!.shots++;
    });

    return Array.from(statsMap.values());
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
              <GoalsSection teamName={state.live.homeTeamName} goals={allHomeGoals} />
              <GoalsSection teamName={state.live.awayTeamName} goals={allAwayGoals} />
            </div>

            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PenaltiesSection team="home" teamName={state.live.homeTeamName} penalties={allHomePenalties} />
              <PenaltiesSection team="away" teamName={state.live.awayTeamName} penalties={allAwayPenalties} />
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PlayerStatsSection key={`home-total-${refreshKey}`} teamName={state.live.homeTeamName} allPlayers={homeTeam?.players} playerStats={state.live.gameSummary.home.playerStats} attendance={state.live.gameSummary.attendance.home} />
                <PlayerStatsSection key={`away-total-${refreshKey}`} teamName={state.live.awayTeamName} allPlayers={awayTeam?.players} playerStats={state.live.gameSummary.away.playerStats} attendance={state.live.gameSummary.attendance.away} />
            </div>
            
            {(state.live.shootout.homeAttempts.length > 0 || state.live.shootout.awayAttempts.length > 0) && (
              <>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ShootoutSection teamName={state.live.homeTeamName} attempts={state.live.shootout.homeAttempts} />
                    <ShootoutSection teamName={state.live.awayTeamName} attempts={state.live.shootout.awayAttempts} />
                </div>
              </>
            )}

            <Separator />

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-xl text-primary-foreground hover:no-underline flex justify-between items-center w-full">
                  <span>Estadísticas por Periodo</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="flex justify-end pr-2 mb-4">
                      {isEditing ? (
                          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" onClick={handleSaveClick}><Check className="h-5 w-5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleCancelClick}><XCircle className="h-5 w-5" /></Button>
                          </div>
                      ) : (
                          <Button variant="outline" size="sm" onClick={e => {e.stopPropagation(); handleEditClick();}}>
                              <Edit3 className="mr-2 h-4 w-4"/>Editar Tiros
                          </Button>
                      )}
                  </div>
                  <div className="space-y-8 pl-2">
                    {allPeriodTexts.map(periodText => {
                       const homePlayerStatsInPeriod = getPlayerStatsForPeriod(periodText, 'home');
                       const awayPlayerStatsInPeriod = getPlayerStatsForPeriod(periodText, 'away');

                      return (
                        <div key={periodText} className="space-y-4">
                          <h3 className="text-xl font-semibold text-center text-primary-foreground border-b pb-2 mb-4">
                            {periodText}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <PlayerStatsSection teamName={state.live.homeTeamName} allPlayers={homeTeam?.players} playerStats={homePlayerStatsInPeriod} attendance={state.live.gameSummary.attendance.home} editable={isEditing} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
                              <PlayerStatsSection teamName={state.live.awayTeamName} allPlayers={awayTeam?.players} playerStats={awayPlayerStatsInPeriod} attendance={state.live.gameSummary.attendance.away} editable={isEditing} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
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
            <Button type="button" variant="outline" onClick={() => handleExportPDF()}><FileDown className="mr-2 h-4 w-4" />Exportar a PDF</Button>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="outline"><X className="mr-2 h-4 w-4" />Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
