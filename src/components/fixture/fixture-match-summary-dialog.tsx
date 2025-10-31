
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Edit3, Check, XCircle } from "lucide-react";
import type { MatchData, Tournament, GameSummary, SummaryPlayerStats, PlayerData, PeriodStats, Team, GoalLog, PenaltyLog, PeriodSummary } from "@/types";
import { useGameState, getCategoryNameById, getPeriodText } from "@/contexts/game-state-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GoalsSection } from "../summary/goals-section";
import { PenaltiesSection } from "../summary/penalties-section";
import { PlayerStatsSection } from "../summary/player-stats-section";
import { ShootoutSection } from "../summary/shootout-section";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "../ui/separator";
import { AddPenaltyForm } from "../shared/add-penalty-form";
import { safeUUID } from "@/lib/utils";
import { recalculateAllStatsFromLogs } from "@/lib/summary-generator";


interface FixtureMatchSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  match: MatchData | null;
  tournament: Tournament | null;
}

type EditableStats = Record<string, Record<string, { shots: string }>>;

export function FixtureMatchSummaryDialog({ isOpen, onOpenChange, match, tournament }: FixtureMatchSummaryDialogProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  
  const [localSummary, setLocalSummary] = useState<GameSummary | undefined>(match?.summary);
  const [isEditing, setIsEditing] = useState(false);
  const [editedShots, setEditedShots] = useState<EditableStats>({});
  
  const [isAddPenaltyOpen, setIsAddPenaltyOpen] = useState(false);
  const [addPenaltyContext, setAddPenaltyContext] = useState<{team: Team, period: string} | null>(null);

  useEffect(() => {
    if (isOpen && match?.summary) {
      setLocalSummary(match.summary);
      setIsEditing(false);
    }
  }, [isOpen, match]);
  
  const homeTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.homeTeamId), [tournament, match]);
  const awayTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.awayTeamId), [tournament, match]);
  const categoryName = useMemo(() => getCategoryNameById(match?.categoryId || '', tournament?.categories), [match, tournament]);
  
  const aggregatedStats = useMemo(() => {
    if (!localSummary || !homeTeam || !awayTeam) return { home: [], away: [] };
    return recalculateAllStatsFromLogs(localSummary, homeTeam.players, awayTeam.players);
  }, [localSummary, homeTeam, awayTeam]);


  const handleEditClick = () => {
    const initialShots: EditableStats = {};
    if (localSummary?.statsByPeriod) {
        localSummary.statsByPeriod.forEach(({ period, stats }) => {
            initialShots[period] = {};
            ['home', 'away'].forEach(team => {
                const teamData = team === 'home' ? homeTeam : awayTeam;
                teamData?.players.forEach(player => {
                    const playerStat = stats.playerStats[team as Team].find(ps => ps.id === player.id);
                    if (!initialShots[period][player.id]) {
                       initialShots[period][player.id] = { shots: String(playerStat?.shots || 0) };
                    }
                });
            });
        });
    }
    setEditedShots(initialShots);
    setIsEditing(true);
  };
  
  const handleCancelClick = () => setIsEditing(false);

  const handleSaveClick = () => {
    if (!localSummary || !match || !tournament || !homeTeam || !awayTeam) return;

    const newSummary: GameSummary = JSON.parse(JSON.stringify(localSummary));

    (newSummary.statsByPeriod || []).forEach(periodSummary => {
      const periodText = periodSummary.period;
        for (const team of ['home', 'away'] as const) {
          const roster = team === 'home' ? homeTeam.players : awayTeam.players;
          roster.forEach(player => {
            const playerEditedStats = editedShots[periodText]?.[player.id];
            if (playerEditedStats) {
              const newShotCount = parseInt(playerEditedStats.shots, 10) || 0;
              let periodStats = periodSummary.stats.playerStats[team] as SummaryPlayerStats[];
              let playerStat = periodStats.find(p => p.id === player.id);
              if (playerStat) {
                playerStat.shots = newShotCount;
              } else {
                periodStats.push({ id: player.id, name: player.name, number: player.number, shots: newShotCount, goals: 0, assists: 0 });
              }
            }
          });
        }
    });
    
    // The rest of the stats are derived from goals/penalties which are handled via dispatch
    // We only need to save the shot changes here.
    dispatch({ type: 'SAVE_MATCH_SUMMARY', payload: { matchId: match.id, summary: newSummary }});
    setLocalSummary(newSummary);
    toast({ title: "Resumen Guardado", description: "Los cambios en las estadísticas de tiros han sido guardados."});

    setIsEditing(false);
  };
  
  const handleStatInputChange = (period: string, playerId: string, field: 'shots', value: string) => {
    if (/^\d*$/.test(value)) {
        setEditedShots(prev => ({
            ...prev,
            [period]: {
                ...prev[period],
                [playerId]: { ...(prev[period]?.[playerId] || { shots: '0' }), [field]: value },
            }
        }));
    }
  };

  const handleGoalChange = (action: 'add' | 'update' | 'delete', team: Team, periodText: string, goal: GoalLog, originalGoalId?: string) => {
      if (!match) return;
      const type = action === 'add' ? 'SUMMARY_ADD_GOAL' : (action === 'update' ? 'SUMMARY_UPDATE_GOAL' : 'SUMMARY_DELETE_GOAL');
      const payload: any = { matchId: match.id, team, periodText, goal };
      if (originalGoalId) payload.originalGoalId = originalGoalId;

      dispatch({ type, payload });
      toast({ title: "Cambio en Goles Guardado", description: "El resumen ha sido actualizado." });
  };
  
  const handleAddPenaltyClick = (team: Team, period: string) => {
    setAddPenaltyContext({ team, period });
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
    
    dispatch({ type: 'SUMMARY_ADD_PENALTY', payload: { matchId: match.id, team, periodText: periodText || 'N/A', penalty: penaltyLog }});

    toast({ title: "Penalidad Añadida", description: "La penalidad se ha añadido manualmente al resumen."});
    setIsAddPenaltyOpen(false);
  };

  const handleDeletePenalty = (team: Team, logId: string, periodText: string) => {
     if (!localSummary || !match) return;
     dispatch({ type: 'SUMMARY_DELETE_PENALTY', payload: { matchId: match.id, team, periodText, penaltyId: logId }});
     toast({ title: "Penalidad Eliminada", variant: "destructive" });
  };


  useEffect(() => {
    const updatedSummary = tournament?.matches.find(m => m.id === match?.id)?.summary;
    if (updatedSummary && JSON.stringify(updatedSummary) !== JSON.stringify(localSummary)) {
      setLocalSummary(updatedSummary);
    }
  }, [state.config.tournaments, match, tournament, localSummary]);


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
            <h3 className="text-2xl font-bold text-primary">{homeTeam?.name} - <span className="text-accent">{localSummary.goals.home.length}</span></h3>
            <h3 className="text-2xl font-bold text-primary">{awayTeam?.name} - <span className="text-accent">{localSummary.goals.away.length}</span></h3>
        </div>

        <ScrollArea className="flex-grow my-2 border-t pt-4 pr-6 -mr-6">
          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GoalsSection teamName={homeTeam?.name || ''} goals={localSummary.goals.home} onGoalChange={() => {}} editable={false} />
                <GoalsSection teamName={awayTeam?.name || ''} goals={localSummary.goals.away} onGoalChange={() => {}} editable={false} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={localSummary.penalties.home} />
                  <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={localSummary.penalties.away} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PlayerStatsSection teamName={homeTeam?.name || ''} allPlayers={homeTeam?.players} playerStats={aggregatedStats.home} attendance={localSummary.attendance.home} editable={false} />
                  <PlayerStatsSection teamName={awayTeam?.name || ''} allPlayers={awayTeam?.players} playerStats={aggregatedStats.away} attendance={localSummary.attendance.away} editable={false} />
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
              
              {(localSummary.statsByPeriod || []).length > 0 && (
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
                            {(localSummary.statsByPeriod || []).map(({ period, stats }) => {
                                return (
                                    <div key={period} className="space-y-4 border-l-2 pl-4 ml-2">
                                        <h3 className="text-lg font-semibold">{period}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-4">
                                                <GoalsSection teamName={homeTeam?.name || ''} goals={stats.goals.home || []} onGoalChange={(action, goal, originalId) => handleGoalChange(action, 'home', period, goal, originalId)} editable={true} players={homeTeam?.players} />
                                                <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={stats.penalties.home || []} onAdd={() => handleAddPenaltyClick('home', period)} onDelete={(id) => handleDeletePenalty('home', id, period)} />
                                                <PlayerStatsSection teamName={homeTeam?.name || ''} allPlayers={homeTeam?.players} playerStats={stats.playerStats.home} attendance={localSummary.attendance.home} editable={isEditing} editedStats={editedShots[period]} onStatChange={(playerId, field, value) => handleStatInputChange(period, playerId, field, value)} />
                                            </div>
                                             <div className="space-y-4">
                                                <GoalsSection teamName={awayTeam?.name || ''} goals={stats.goals.away || []} onGoalChange={(action, goal, originalId) => handleGoalChange(action, 'away', period, goal, originalId)} editable={true} players={awayTeam?.players} />
                                                <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={stats.penalties.away || []} onAdd={() => handleAddPenaltyClick('away', period)} onDelete={(id) => handleDeletePenalty('away', id, period)} />
                                                <PlayerStatsSection teamName={awayTeam?.name || ''} allPlayers={awayTeam?.players} playerStats={stats.playerStats.away} attendance={localSummary.attendance.away} editable={isEditing} editedStats={editedShots[period]} onStatChange={(playerId, field, value) => handleStatInputChange(period, playerId, field, value)} />
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
              penaltyTypes={state.config.penaltyTypes}
              defaultPenaltyTypeId={state.config.defaultPenaltyTypeId}
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
