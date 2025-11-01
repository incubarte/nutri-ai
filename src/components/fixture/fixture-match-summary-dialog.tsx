"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Edit3, Check, XCircle } from "lucide-react";
import type { MatchData, Tournament, GameSummary, SummaryPlayerStats, PlayerData, PeriodStats, Team, GoalLog, PenaltyLog, PeriodSummary } from "@/types";
import { useGameState, getCategoryNameById } from "@/contexts/game-state-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GoalsSection } from "../summary/goals-section";
import { PenaltiesSection } from "../summary/penalties-section";
import { PlayerStatsSection } from "../summary/player-stats-section";
import { ShootoutSection } from "../summary/shootout-section";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "../ui/separator";
import { AddPenaltyForm } from "../shared/add-penalty-form";
import { safeUUID } from "@/lib/utils";

interface FixtureMatchSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  match: MatchData | null;
  tournament: Tournament | null;
}

type EditableStats = Record<string, Record<string, { shots: string }>>;

export function FixtureMatchSummaryDialog({ isOpen, onOpenChange, match, tournament }: FixtureMatchSummaryDialogProps) {
  const { dispatch } = useGameState();
  const { toast } = useToast();
  
  const [localSummary, setLocalSummary] = useState<GameSummary | undefined>(undefined);
  const [isEditing, setIsEditing] = useState(false);
  const [editedShots, setEditedShots] = useState<EditableStats>({});
  
  const [isAddPenaltyOpen, setIsAddPenaltyOpen] = useState(false);
  const [addPenaltyContext, setAddPenaltyContext] = useState<{team: Team, period: string} | null>(null);

  useEffect(() => {
    if (isOpen && match?.summary) {
      setLocalSummary(JSON.parse(JSON.stringify(match.summary))); // Deep copy
    } else {
      setLocalSummary(undefined);
    }
    setIsEditing(false);
  }, [isOpen, match]);
  
  const homeTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.homeTeamId), [tournament, match]);
  const awayTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.awayTeamId), [tournament, match]);
  const categoryName = useMemo(() => getCategoryNameById(match?.categoryId || '', tournament?.categories), [match, tournament]);

  const aggregatedGoals = useMemo(() => {
    if (!localSummary?.statsByPeriod) return { home: [], away: [] };
    return localSummary.statsByPeriod.reduce((acc, periodSummary) => {
        acc.home.push(...(periodSummary.stats.goals.home || []));
        acc.away.push(...(periodSummary.stats.goals.away || []));
        return acc;
    }, { home: [] as GoalLog[], away: [] as GoalLog[] });
  }, [localSummary]);

  const aggregatedPenalties = useMemo(() => {
    if (!localSummary?.statsByPeriod) return { home: [], away: [] };
    return localSummary.statsByPeriod.reduce((acc, periodSummary) => {
        acc.home.push(...(periodSummary.stats.penalties.home || []));
        acc.away.push(...(periodSummary.stats.penalties.away || []));
        return acc;
    }, { home: [] as PenaltyLog[], away: [] as PenaltyLog[] });
  }, [localSummary]);

  const aggregatedStats = useMemo(() => {
    if (!localSummary || !homeTeam || !awayTeam) return { home: [], away: [] };
    
    const statsMap: { home: Map<string, SummaryPlayerStats>, away: Map<string, SummaryPlayerStats> } = {
        home: new Map(),
        away: new Map()
    };

    homeTeam.players.forEach(p => statsMap.home.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));
    awayTeam.players.forEach(p => statsMap.away.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

    (localSummary.statsByPeriod || []).forEach(period => {
      ['home', 'away'].forEach(teamStr => {
        const team = teamStr as Team;
        const currentTeamRoster = team === 'home' ? homeTeam.players : awayTeam.players;
        const currentTeamMap = team === 'home' ? statsMap.home : statsMap.away;

        (period.stats.goals[team] || []).forEach(goal => {
            const scorerId = currentTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
            if (scorerId && currentTeamMap.has(scorerId)) currentTeamMap.get(scorerId)!.goals++;
            const assistId = currentTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
            if (assistId && currentTeamMap.has(assistId)) currentTeamMap.get(assistId)!.assists++;
        });

         (period.stats.playerStats[team] || []).forEach(pStat => {
             if(currentTeamMap.has(pStat.id)) {
                 currentTeamMap.get(pStat.id)!.shots += pStat.shots;
             }
         });
      });
    });

    return { home: Array.from(statsMap.home.values()), away: Array.from(statsMap.away.values()) };
  }, [localSummary, homeTeam, awayTeam]);

  const handleGoalChange = (action: 'add' | 'update' | 'delete', team: Team, periodText: string, goal: GoalLog, originalGoalId?: string) => {
    setLocalSummary(prevSummary => {
        if (!prevSummary) return undefined;
        const newSummary = JSON.parse(JSON.stringify(prevSummary));
        let period = newSummary.statsByPeriod.find((p: PeriodSummary) => p.period === periodText);
        if (!period) {
            period = { period: periodText, stats: { goals: { home: [], away: [] }, penalties: { home: [], away: [] }, playerStats: { home: [], away: [] } }};
            newSummary.statsByPeriod.push(period);
        }

        switch (action) {
            case 'add':
                period.stats.goals[team].push(goal);
                break;
            case 'update':
                const index = period.stats.goals[team].findIndex((g: GoalLog) => g.id === originalGoalId);
                if (index !== -1) period.stats.goals[team][index] = goal;
                break;
            case 'delete':
                period.stats.goals[team] = period.stats.goals[team].filter((g: GoalLog) => g.id !== originalGoalId);
                break;
        }
        return newSummary;
    });
  };

  const handlePenaltyChange = (action: 'add' | 'delete', team: Team, periodText: string, penalty: PenaltyLog) => {
    setLocalSummary(prevSummary => {
        if (!prevSummary) return undefined;
        const newSummary = JSON.parse(JSON.stringify(prevSummary));
        let period = newSummary.statsByPeriod.find((p: PeriodSummary) => p.period === periodText);
        if (!period) {
            period = { period: periodText, stats: { goals: { home: [], away: [] }, penalties: { home: [], away: [] }, playerStats: { home: [], away: [] } }};
            newSummary.statsByPeriod.push(period);
        }

        if (action === 'add') {
            period.stats.penalties[team].push(penalty);
        } else { // delete
            period.stats.penalties[team] = period.stats.penalties[team].filter((p: PenaltyLog) => p.id !== penalty.id);
        }
        return newSummary;
    });
  };

  const handleAddPenaltyClick = (team: Team, period: string) => {
    setAddPenaltyContext({ team, period });
    setIsAddPenaltyOpen(true);
  };
  
  const handleAddPenaltySubmit = (team: Team, playerNumber: string, penaltyTypeId: string, gameTimeCs?: number, periodText?: string) => {
    if(!match || !tournament) return;
    const penaltyDef = tournament.penaltyTypes.find(p => p.id === penaltyTypeId);
    if (!penaltyDef) return;

    const penaltyLog: PenaltyLog = {
      id: `manual-${safeUUID()}`,
      team, playerNumber, penaltyName: penaltyDef.name, initialDuration: penaltyDef.duration,
      reducesPlayerCount: penaltyDef.reducesPlayerCount, clearsOnGoal: penaltyDef.clearsOnGoal,
      isBenchPenalty: penaltyDef.isBenchPenalty, addTimestamp: new Date(match.date).getTime(),
      addGameTime: gameTimeCs || 0, addPeriodText: periodText || 'N/A', endReason: 'completed',
      timeServed: penaltyDef.duration,
    };
    
    handlePenaltyChange('add', team, periodText || 'N/A', penaltyLog);
    toast({ title: "Penalidad Añadida", description: "La penalidad se ha añadido manualmente al resumen."});
    setIsAddPenaltyOpen(false);
  };

  const handleDeletePenalty = (team: Team, log: PenaltyLog, periodText: string) => {
     handlePenaltyChange('delete', team, periodText, log);
     toast({ title: "Penalidad Eliminada", variant: "destructive" });
  };
  
  const handleSaveAllChanges = () => {
    if (!localSummary || !match || !tournament) return;
    dispatch({ type: 'SAVE_MATCH_SUMMARY', payload: { matchId: match.id, summary: localSummary } });
    toast({ title: "Resumen Guardado", description: "Todos los cambios en el resumen del partido han sido guardados."});
    onOpenChange(false);
  };

  if (!match || !tournament || !localSummary) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Resumen de Partido Jugado</DialogTitle>
          <DialogDescription>
            {homeTeam?.name || '?'} vs {awayTeam?.name || '?'} - Cat: {categoryName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 text-center my-2">
            <h3 className="text-2xl font-bold text-primary">{homeTeam?.name} - <span className="text-accent">{aggregatedGoals.home.length}</span></h3>
            <h3 className="text-2xl font-bold text-primary">{awayTeam?.name} - <span className="text-accent">{aggregatedGoals.away.length}</span></h3>
        </div>

        <ScrollArea className="flex-grow my-2 border-t pt-4 pr-6 -mr-6">
          <div className="space-y-6">
              <Accordion type="single" collapsible className="w-full" defaultValue="goals">
                <AccordionItem value="goals">
                    <AccordionTrigger className="text-xl hover:no-underline">Goles</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <GoalsSection teamName={homeTeam?.name || ''} goals={aggregatedGoals.home} onGoalChange={(action, goal, id) => handleGoalChange(action, 'home', goal.periodText, goal, id)} editable={true} players={homeTeam?.players} />
                        <GoalsSection teamName={awayTeam?.name || ''} goals={aggregatedGoals.away} onGoalChange={(action, goal, id) => handleGoalChange(action, 'away', goal.periodText, goal, id)} editable={true} players={awayTeam?.players} />
                      </div>
                    </AccordionContent>
                </AccordionItem>
                <AccordionItem value="penalties">
                    <AccordionTrigger className="text-xl hover:no-underline">Penalidades</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={aggregatedPenalties.home} onDelete={(id) => { const p = aggregatedPenalties.home.find(pen => pen.id === id); if (p) handleDeletePenalty('home', p, p.addPeriodText); }} />
                          <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={aggregatedPenalties.away} onDelete={(id) => { const p = aggregatedPenalties.away.find(pen => pen.id === id); if (p) handleDeletePenalty('away', p, p.addPeriodText); }} />
                      </div>
                    </AccordionContent>
                </AccordionItem>
                 <AccordionItem value="player-stats">
                    <AccordionTrigger className="text-xl hover:no-underline">Estadísticas por Jugador</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <PlayerStatsSection teamName={homeTeam?.name || ''} allPlayers={homeTeam?.players} playerStats={aggregatedStats.home} attendance={localSummary.attendance.home} editable={false} />
                          <PlayerStatsSection teamName={awayTeam?.name || ''} allPlayers={awayTeam?.players} playerStats={aggregatedStats.away} attendance={localSummary.attendance.away} editable={false} />
                      </div>
                    </AccordionContent>
                </AccordionItem>
              </Accordion>
              
               {localSummary.shootout && (localSummary.shootout.homeAttempts.length > 0 || localSummary.shootout.awayAttempts.length > 0) && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ShootoutSection teamName={homeTeam?.name || ''} attempts={localSummary.shootout.homeAttempts} />
                          <ShootoutSection teamName={awayTeam?.name || ''} attempts={localSummary.shootout.awayAttempts} />
                      </div>
                    </>
                )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline"><X className="mr-2 h-4 w-4" />Cancelar</Button>
          </DialogClose>
          <Button type="button" onClick={handleSaveAllChanges}><Check className="mr-2 h-4 w-4" />Guardar Cambios</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {addPenaltyContext && (
       <Dialog open={isAddPenaltyOpen} onOpenChange={setIsAddPenaltyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir Penalidad Manual</DialogTitle>
              <DialogDescription>Añadiendo una penalidad para {addPenaltyContext.team === 'home' ? homeTeam?.name : awayTeam?.name} en el período {addPenaltyContext.period}.</DialogDescription>
            </DialogHeader>
            <AddPenaltyForm
              homeTeamName={homeTeam?.name || 'Local'}
              awayTeamName={awayTeam?.name || 'Visitante'}
              penaltyTypes={tournament.penaltyTypes || []}
              defaultPenaltyTypeId={tournament.defaultPenaltyTypeId || null}
              onPenaltySent={handleAddPenaltySubmit}
              preselectedTeam={addPenaltyContext.team}
              showTimeInput={true}
              availablePeriods={localSummary.playedPeriods}
              preselectedPeriod={addPenaltyContext.period}
            />
          </DialogContent>
       </Dialog>
    )}
    </>
  );
}
