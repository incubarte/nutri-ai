
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Edit3, Check, XCircle } from "lucide-react";
import type { MatchData, Tournament, GameSummary, SummaryPlayerStats, PlayerData, PeriodStats, Team, GoalLog, PenaltyLog } from "@/types";
import { useGameState, getCategoryNameById, getPeriodText } from "@/contexts/game-state-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GoalsSection } from "../summary/goals-section";
import { PenaltiesSection } from "../summary/penalties-section";
import { PlayerStatsSection } from "../summary/player-stats-section";
import { ShootoutSection } from "../summary/shootout-section";
import { useToast } from "@/hooks/use-toast";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";
import { AddPenaltyForm } from "../shared/add-penalty-form";
import { safeUUID } from "@/lib/utils";
import { generateSummaryData, recalculateAllStatsFromLogs } from "@/lib/summary-generator";


interface FixtureMatchSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  match: MatchData | null;
  tournament: Tournament | null;
}

type EditableStats = Record<string, Record<string, { shots: string; goals: string; assists: string }>>;

export function FixtureMatchSummaryDialog({ isOpen, onOpenChange, match, tournament }: FixtureMatchSummaryDialogProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  
  const [localSummary, setLocalSummary] = useState<GameSummary | undefined>(match?.summary);
  const [isEditing, setIsEditing] = useState(false);
  const [editedStats, setEditedStats] = useState<EditableStats>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // States for adding penalties/goals
  const [isAddPenaltyOpen, setIsAddPenaltyOpen] = useState(false);
  const [addContext, setAddContext] = useState<{team: Team, period: string} | null>(null);

  useEffect(() => {
    if (isOpen && match?.summary) {
      setLocalSummary(match.summary);
      setIsEditing(false);
    }
  }, [isOpen, match]);
  
  const homeTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.homeTeamId), [tournament, match]);
  const awayTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.awayTeamId), [tournament, match]);
  const categoryName = useMemo(() => getCategoryNameById(match?.categoryId || '', tournament?.categories), [match, tournament]);

  const allPeriodTexts = useMemo(() => {
    return localSummary?.playedPeriods || [];
  }, [localSummary]);

  const handleEditClick = () => {
    const initialStats: EditableStats = {};
    if (localSummary?.statsByPeriod) {
        allPeriodTexts.forEach(periodText => {
            initialStats[periodText] = {};
            ['home', 'away'].forEach(team => {
                const teamData = team === 'home' ? homeTeam : awayTeam;
                teamData?.players.forEach(player => {
                    const periodStats = localSummary.statsByPeriod?.[periodText]?.playerStats[team as Team] || [];
                    const stat = periodStats.find(ps => ps.id === player.id);
                    if (!initialStats[periodText][player.id]) {
                       initialStats[periodText][player.id] = {
                           shots: String(stat?.shots || 0),
                           goals: String(stat?.goals || 0),
                           assists: String(stat?.assists || 0),
                       };
                    }
                });
            });
        });
    }
    setEditedStats(initialStats);
    setIsEditing(true);
  };
  
  const handleCancelClick = () => setIsEditing(false);

  const handleSaveClick = () => {
    if (!localSummary || !match || !tournament || !homeTeam || !awayTeam) return;

    let summaryChanged = false;
    const newSummary: GameSummary = JSON.parse(JSON.stringify(localSummary));
    newSummary.goals = { home: [], away: [] }; // Reset goals, will be rebuilt
    
    // Rebuild goals and statsByPeriod from editedStats
    for (const periodText in editedStats) {
      if (!newSummary.statsByPeriod) newSummary.statsByPeriod = {};
      if (!newSummary.statsByPeriod[periodText]) {
        newSummary.statsByPeriod[periodText] = {
            goals: { home: [], away: [] },
            penalties: newSummary.statsByPeriod[periodText]?.penalties || { home: [], away: [] },
            playerStats: { home: [], away: [] }
        };
      }
      
      for (const team of ['home', 'away'] as const) {
        const roster = team === 'home' ? homeTeam.players : awayTeam.players;
        roster.forEach(player => {
          const playerEditedStats = editedStats[periodText]?.[player.id];
          if (playerEditedStats) {
            // Update goals for the period and the total
            const newGoalCount = parseInt(playerEditedStats.goals, 10) || 0;
            const existingGoals = newSummary.statsByPeriod![periodText].goals[team].filter(g => g.scorer?.playerNumber === player.number).length;
            if (newGoalCount > existingGoals) {
              for (let i = 0; i < newGoalCount - existingGoals; i++) {
                const newGoal: GoalLog = { id: safeUUID(), team, timestamp: 0, gameTime: 0, periodText, scorer: { playerNumber: player.number, playerName: player.name } };
                newSummary.statsByPeriod![periodText].goals[team].push(newGoal);
                newSummary.goals[team].push(newGoal);
                summaryChanged = true;
              }
            }
          }
        });
      }
    }
    
    // Recalculate all player stats from the newly built goals and edited shots
    const fullRoster = { home: homeTeam.players, away: awayTeam.players };
    const { home, away } = recalculateAllStatsFromLogs(newSummary, fullRoster.home, fullRoster.away);
    newSummary.playerStats.home = home;
    newSummary.playerStats.away = away;

    // Recalculate stats for each period
     for (const periodText in newSummary.statsByPeriod) {
        const periodSummary: Partial<GameSummary> = {
            goals: newSummary.statsByPeriod[periodText].goals,
            // Shots need to be derived from editedStats for this period
        };
        const {home: periodHomeStats, away: periodAwayStats} = recalculateAllStatsFromLogs(periodSummary as GameSummary, fullRoster.home, fullRoster.away);
        
        // Manually add the edited shots to the recalculated stats
        [...periodHomeStats, ...periodAwayStats].forEach(pStat => {
          const teamType = fullRoster.home.some(p => p.id === pStat.id) ? 'home' : 'away';
           const editedPlayerStat = editedStats[periodText]?.[pStat.id];
           if(editedPlayerStat) {
             pStat.shots = parseInt(editedPlayerStat.shots, 10) || 0;
             pStat.assists = parseInt(editedPlayerStat.assists, 10) || 0;
           }
        });

        newSummary.statsByPeriod[periodText].playerStats = { home: periodHomeStats, away: periodAwayStats };
     }


    dispatch({
        type: 'SAVE_MATCH_SUMMARY',
        payload: { matchId: match.id, summary: newSummary }
    });
    setLocalSummary(newSummary);
    setRefreshKey(k => k + 1);
    toast({ title: "Resumen Guardado", description: "Los cambios en las estadísticas han sido guardados."});

    setIsEditing(false);
  };

  const handleStatInputChange = (period: string, playerId: string, field: 'shots' | 'goals' | 'assists', value: string) => {
    if (/^\d*$/.test(value)) {
        setEditedStats(prev => ({
            ...prev,
            [period]: {
                ...prev[period],
                [playerId]: {
                    ...(prev[period]?.[playerId] || { shots: '0', goals: '0', assists: '0' }),
                    [field]: value
                },
            }
        }));
    }
  };
  
  const handleAddPenaltyClick = (team: Team, period: string) => {
    setAddContext({ team, period });
    setIsAddPenaltyOpen(true);
  };

  const handleAddPenaltySubmit = (team: Team, playerNumber: string, penaltyTypeId: string, gameTimeCs?: number, periodText?: string) => {
    if(!match || !tournament) return;
    const penaltyDef = state.config.penaltyTypes.find(p => p.id === penaltyTypeId);
    if (!penaltyDef) return;

    const penaltyLog: PenaltyLog = {
      id: `manual-${safeUUID()}`,
      team,
      playerNumber,
      penaltyName: penaltyDef.name,
      initialDuration: penaltyDef.duration,
      reducesPlayerCount: penaltyDef.reducesPlayerCount,
      clearsOnGoal: penaltyDef.clearsOnGoal,
      isBenchPenalty: penaltyDef.isBenchPenalty,
      addTimestamp: new Date(match.date).getTime(),
      addGameTime: gameTimeCs || 0,
      addPeriodText: periodText || 'N/A',
      endReason: 'completed', // Assume completed for manual entries
      timeServed: penaltyDef.duration,
    };

    const newSummary = JSON.parse(JSON.stringify(localSummary));
    newSummary.penalties[team].push(penaltyLog);
    
    // Add to period-specific penalties as well
    if (periodText && newSummary.statsByPeriod?.[periodText]) {
        newSummary.statsByPeriod[periodText].penalties[team].push(penaltyLog);
    }
    
    dispatch({ type: 'SAVE_MATCH_SUMMARY', payload: { matchId: match.id, summary: newSummary }});
    setLocalSummary(newSummary);
    toast({ title: "Penalidad Añadida", description: "La penalidad se ha añadido manualmente al resumen."});
    setIsAddPenaltyOpen(false);
  };

  const handleDeletePenalty = (team: Team, logId: string, periodText: string) => {
     if (!localSummary || !match || !tournament) return;
      const newSummary = JSON.parse(JSON.stringify(localSummary));
      newSummary.penalties[team] = newSummary.penalties[team].filter((p: PenaltyLog) => p.id !== logId);
      
      if (periodText && newSummary.statsByPeriod?.[periodText]) {
        newSummary.statsByPeriod[periodText].penalties[team] = newSummary.statsByPeriod[periodText].penalties[team].filter((p: PenaltyLog) => p.id !== logId);
      }

      dispatch({ type: 'SAVE_MATCH_SUMMARY', payload: { matchId: match.id, summary: newSummary }});
      setLocalSummary(newSummary);
      toast({ title: "Penalidad Eliminada", variant: "destructive" });
  };


  if (!match || !tournament || !localSummary) return null;
  
  const aggregatedStats = localSummary.playerStats;

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
            <h3 className="text-2xl font-bold text-primary">{homeTeam?.name} - <span className="text-accent">{localSummary.goals.home.length}</span></h3>
            <h3 className="text-2xl font-bold text-primary">{awayTeam?.name} - <span className="text-accent">{localSummary.goals.away.length}</span></h3>
        </div>

        <ScrollArea className="flex-grow my-2 border-t pt-4 pr-6 -mr-6">
          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GoalsSection teamName={homeTeam?.name || ''} goals={localSummary.goals.home} />
                <GoalsSection teamName={awayTeam?.name || ''} goals={localSummary.goals.away} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={localSummary.penalties.home} />
                  <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={localSummary.penalties.away} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PlayerStatsSection teamName={homeTeam?.name || ''} allPlayers={homeTeam?.players} playerStats={aggregatedStats.home} attendance={localSummary.attendance.home} />
                  <PlayerStatsSection teamName={awayTeam?.name || ''} allPlayers={awayTeam?.players} playerStats={aggregatedStats.away} attendance={localSummary.attendance.away} />
              </div>
              
               {localSummary.shootout && (localSummary.shootout.homeAttempts.length > 0 || localSummary.shootout.awayAttempts.length > 0) && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <ShootoutSection teamName={homeTeam?.name || ''} attempts={localSummary.shootout.homeAttempts} />
                          <ShootoutSection teamName={awayTeam?.name || ''} attempts={localSummary.shootout.awayAttempts} />
                      </div>
                    </>
                )}
              
              {allPeriodTexts.length > 0 && (
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="periods">
                        <div className="flex justify-between items-center pr-2">
                            <AccordionTrigger className="text-xl flex-grow hover:no-underline">
                                Detalle por Período
                            </AccordionTrigger>
                        </div>
                        <AccordionContent className="space-y-6 pl-2">
                             <div className="flex justify-end pr-2">
                                {isEditing ? (
                                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" onClick={handleSaveClick}><Check className="h-5 w-5" /></Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleCancelClick}><XCircle className="h-5 w-5" /></Button>
                                    </div>
                                ) : (
                                    <Button variant="outline" size="sm" onClick={e => {e.stopPropagation(); handleEditClick();}}>
                                        <Edit3 className="mr-2 h-4 w-4"/>Editar Stats
                                    </Button>
                                )}
                            </div>
                            {allPeriodTexts.map(periodText => {
                                const periodStats = localSummary.statsByPeriod?.[periodText];
                                return (
                                    <div key={periodText} className="space-y-4 border-l-2 pl-4 ml-2">
                                        <h3 className="text-lg font-semibold">{periodText}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-4">
                                                <GoalsSection teamName={homeTeam?.name || ''} goals={periodStats?.goals.home || []}/>
                                                <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={periodStats?.penalties.home || []} onAdd={() => handleAddPenaltyClick('home', periodText)} onDelete={(id) => handleDeletePenalty('home', id, periodText)} />
                                                <PlayerStatsSection teamName={homeTeam?.name || ''} allPlayers={homeTeam?.players} playerStats={periodStats?.playerStats.home} attendance={localSummary.attendance.home} editable={isEditing} editedStats={editedStats[periodText]} onStatChange={(playerId, field, value) => handleStatInputChange(periodText, playerId, field, value)} />
                                            </div>
                                             <div className="space-y-4">
                                                <GoalsSection teamName={awayTeam?.name || ''} goals={periodStats?.goals.away || []}/>
                                                <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={periodStats?.penalties.away || []} onAdd={() => handleAddPenaltyClick('away', periodText)} onDelete={(id) => handleDeletePenalty('away', id, periodText)} />
                                                <PlayerStatsSection teamName={awayTeam?.name || ''} allPlayers={awayTeam?.players} playerStats={periodStats?.playerStats.away} attendance={localSummary.attendance.away} editable={isEditing} editedStats={editedStats[periodText]} onStatChange={(playerId, field, value) => handleStatInputChange(periodText, playerId, field, value)} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
              )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline"><X className="mr-2 h-4 w-4" />Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {addContext && (
       <Dialog open={isAddPenaltyOpen} onOpenChange={setIsAddPenaltyOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Añadir Penalidad Manual</DialogTitle>
              <DialogDescription>Añadiendo una penalidad para {addContext.team === 'home' ? homeTeam?.name : awayTeam?.name} en el período {addContext.period}.</DialogDescription>
            </DialogHeader>
            <AddPenaltyForm
              homeTeamName={homeTeam?.name || 'Local'}
              awayTeamName={awayTeam?.name || 'Visitante'}
              penaltyTypes={state.config.penaltyTypes}
              defaultPenaltyTypeId={state.config.defaultPenaltyTypeId}
              onPenaltySent={handleAddPenaltySubmit}
              preselectedTeam={addContext.team}
              showTimeInput={true}
              availablePeriods={allPeriodTexts}
              preselectedPeriod={addContext.period}
            />
          </DialogContent>
       </Dialog>
    )}
    </>
  );
}
