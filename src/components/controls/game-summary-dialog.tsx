
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useGameState, formatTime, type Team, type GoalLog, type PenaltyLog, getCategoryNameById, getEndReasonText, type ShotLog, type AttendedPlayerInfo, getPeriodText } from "@/contexts/game-state-context";
import type { PlayerData, SummaryPlayerStats, PeriodSummary } from "@/types";
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
  
  const [isAttendanceEditing, setIsAttendanceEditing] = useState(false);
  const [localAttendance, setLocalAttendance] = useState<{ home: Set<string>, away: Set<string> }>({ home: new Set(), away: new Set() });

  const selectedTournament = useMemo(() => (state.config.tournaments || []).find(t => t.id === state.config.selectedTournamentId), [state.config.tournaments, state.config.selectedTournamentId]);
  
  const { homeTeam, awayTeam } = useMemo(() => {
    if (!selectedTournament) return { homeTeam: null, awayTeam: null };
    const home = selectedTournament.teams.find(t => t.name === state.live.homeTeamName && (t.subName || undefined) === (state.live.homeTeamSubName || undefined) && t.category === state.config.selectedMatchCategory);
    const away = selectedTournament.teams.find(t => t.name === state.live.awayTeamName && (t.subName || undefined) === (state.live.awayTeamSubName || undefined) && t.category === state.config.selectedMatchCategory);
    return { homeTeam: home, awayTeam: away };
  }, [selectedTournament, state.live.homeTeamName, state.live.awayTeamName, state.live.homeTeamSubName, state.live.awayTeamSubName, state.config.selectedMatchCategory]);

  useEffect(() => {
    if (isOpen) {
      setLocalAttendance({
        home: new Set((state.live.attendance?.home || []).map(p => p.id)),
        away: new Set((state.live.attendance?.away || []).map(p => p.id)),
      });
    } else {
      setIsAttendanceEditing(false);
    }
  }, [isOpen, state.live.attendance]);

  const allHomeGoals = useMemo(() => [...(state.live.goals?.home || [])].sort((a, b) => a.timestamp - b.timestamp), [state.live.goals, refreshKey]);
  const allAwayGoals = useMemo(() => [...(state.live.goals?.away || [])].sort((a, b) => a.timestamp - b.timestamp), [state.live.goals, refreshKey]);
  const allHomePenalties = useMemo(() => [...state.live.penaltiesLog.home].sort((a,b) => a.addTimestamp - b.addTimestamp), [state.live.penaltiesLog.home, refreshKey]);
  const allAwayPenalties = useMemo(() => [...state.live.penaltiesLog.away].sort((a,b) => a.addTimestamp - b.addTimestamp), [state.live.penaltiesLog.away, refreshKey]);
  
  const allPeriodTexts = useMemo(() => {
    const periodSet = new Set<string>();
    const allEvents = [
        ...state.live.goals.home,
        ...state.live.goals.away,
        ...state.live.penaltiesLog.home,
        ...state.live.penaltiesLog.away,
        ...(state.live.shotsLog.home || []),
        ...(state.live.shotsLog.away || []),
    ];
    allEvents.forEach(event => {
        const periodText = 'periodText' in event ? event.periodText : event.addPeriodText;
        if (periodText && !periodText.toLowerCase().includes('warm-up')) {
            periodSet.add(periodText);
        }
    });
    
    if(state.live.shootout.homeAttempts.length > 0 || state.live.shootout.awayAttempts.length > 0) {
        if (!periodSet.has("SHOOTOUT")) {
        }
    }
    
    const sortedPeriods = Array.from(periodSet);

    return sortedPeriods.sort((a, b) => {
        const getPeriodNumber = (text: string) => {
            if (text === 'SHOOTOUT') return (state.config.numberOfRegularPeriods || 2) + (state.config.numberOfOvertimePeriods || 0) + 1;
            if (text.startsWith('OT')) return (state.config.numberOfRegularPeriods || 2) + parseInt(text.replace('OT', '') || '1', 10);
            return parseInt(text.replace(/\D/g, ''), 10);
        };
        return getPeriodNumber(a) - getPeriodNumber(b);
    });
  }, [state.live, state.config.numberOfRegularPeriods, state.config.numberOfOvertimePeriods]);

  const handleExportCSV = () => { };
  
  const handleExportPDF = () => {
    const filename = exportGameSummaryPDF(state);
    toast({
        title: "Resumen Descargado",
        description: `El archivo ${filename} se ha guardado.`,
    });
  };

  // --- ATTENDANCE EDITING ---
  const handleToggleAttendance = (team: 'home' | 'away', playerId: string) => {
    if (!isAttendanceEditing) return;
    setLocalAttendance(prev => {
      const newSet = new Set(prev[team]);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return { ...prev, [team]: newSet };
    });
  };

  const handleSaveAttendance = () => {
    dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'home', playerIds: Array.from(localAttendance.home) } });
    dispatch({ type: 'SET_TEAM_ATTENDANCE', payload: { team: 'away', playerIds: Array.from(localAttendance.away) } });
    toast({ title: "Asistencia Actualizada", description: "Se guardaron los cambios en la lista de asistencia." });
    setIsAttendanceEditing(false);
  };
  
  const getPlayerStatsForPeriod = (periodText: string, team: 'home' | 'away'): SummaryPlayerStats[] => {
    const goalsInPeriod = (team === 'home' ? allHomeGoals : allAwayGoals).filter(g => g.periodText === periodText);
    const shotsInPeriod = (team === 'home' ? state.live.shotsLog.home : state.live.shotsLog.away || []).filter(s => s.periodText === periodText);
    const attendance = state.live.attendance[team] || [];

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

  const aggregatedHomeStats = useMemo(() => recalculateAllStatsFromLogs({ goals: {home: allHomeGoals, away: []}, home: { homeShotsLog: state.live.shotsLog.home }}, homeTeam?.players || [], []), [allHomeGoals, state.live.shotsLog.home, homeTeam]);
  const aggregatedAwayStats = useMemo(() => recalculateAllStatsFromLogs({ goals: {home: [], away: allAwayGoals}, away: { awayShotsLog: state.live.shotsLog.away }}, [], awayTeam?.players || []), [allAwayGoals, state.live.shotsLog.away, awayTeam]);

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
                <PlayerStatsSection 
                  teamName={homeTeam?.name || ''} 
                  allPlayers={homeTeam?.players} 
                  playerStats={aggregatedHomeStats} 
                  attendance={state.live.attendance.home}
                  editable={false} 
                  showAttendanceControls={true}
                  isAttendanceEditing={isAttendanceEditing}
                  onToggleAttendance={(playerId) => handleToggleAttendance('home', playerId)}
                  onEditToggle={setIsAttendanceEditing} 
                  onSave={handleSaveAttendance}
                />
                <PlayerStatsSection 
                  teamName={awayTeam?.name || ''}
                  allPlayers={awayTeam?.players}
                  playerStats={aggregatedAwayStats}
                  attendance={state.live.attendance.away}
                  editable={false}
                  showAttendanceControls={true}
                  isAttendanceEditing={isAttendanceEditing}
                  onToggleAttendance={(playerId) => handleToggleAttendance('away', playerId)}
                  onEditToggle={setIsAttendanceEditing}
                  onSave={handleSaveAttendance}
                />
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

// Helper to recalculate stats from logs (could be in a utils file)
const recalculateAllStatsFromLogs = (partialSummary: Partial<{ goals: { home: GoalLog[], away: GoalLog[] }, home: { homeShotsLog?: ShotLog[] }, away: { awayShotsLog?: ShotLog[] } }>, homeTeamRoster: PlayerData[], awayTeamRoster: PlayerData[]): { home: SummaryPlayerStats[], away: SummaryPlayerStats[] } => {
    const homePlayerStatsMap = new Map<string, SummaryPlayerStats>();
    const awayPlayerStatsMap = new Map<string, SummaryPlayerStats>();

    // Initialize with all players from roster to ensure everyone is listed
    homeTeamRoster.forEach(p => homePlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));
    awayTeamRoster.forEach(p => awayPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

    // Process goals and assists
    (partialSummary.goals?.home || []).forEach(goal => {
        const scorerId = homeTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
        if (scorerId && homePlayerStatsMap.has(scorerId)) homePlayerStatsMap.get(scorerId)!.goals++;
        const assistId = homeTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
        if (assistId && homePlayerStatsMap.has(assistId)) homePlayerStatsMap.get(assistId)!.assists++;
    });
     (partialSummary.goals?.away || []).forEach(goal => {
        const scorerId = awayTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
        if (scorerId && awayPlayerStatsMap.has(scorerId)) awayPlayerStatsMap.get(scorerId)!.goals++;
        const assistId = awayTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
        if (assistId && awayPlayerStatsMap.has(assistId)) awayPlayerStatsMap.get(assistId)!.assists++;
    });


    // Process shots
    (partialSummary.home?.homeShotsLog || []).forEach(shot => {
        if (shot.playerId && homePlayerStatsMap.has(shot.playerId)) homePlayerStatsMap.get(shot.playerId)!.shots++;
    });
     (partialSummary.away?.awayShotsLog || []).forEach(shot => {
        if (shot.playerId && awayPlayerStatsMap.has(shot.playerId)) awayPlayerStatsMap.get(shot.playerId)!.shots++;
    });
    
    return { home: Array.from(homePlayerStatsMap.values()), away: Array.from(awayPlayerStatsMap.values()) };
};

