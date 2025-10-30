
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Edit3, Check, XCircle } from "lucide-react";
import type { MatchData, Tournament, GameSummary, Team, SummaryPlayerStats, AttendedPlayerInfo } from "@/types";
import { useGameState, getCategoryNameById } from "@/contexts/game-state-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GoalsSection } from "../summary/goals-section";
import { PenaltiesSection } from "../summary/penalties-section";
import { PlayerStatsSection } from "../summary/player-stats-section";
import { ShootoutSection } from "../summary/shootout-section";
import { useToast } from "@/hooks/use-toast";
import { Input } from "../ui/input";

interface FixtureMatchSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  match: MatchData | null;
  tournament: Tournament | null;
}

export function FixtureMatchSummaryDialog({ isOpen, onOpenChange, match, tournament }: FixtureMatchSummaryDialogProps) {
  const { dispatch } = useGameState();
  const { toast } = useToast();
  
  const [localSummary, setLocalSummary] = useState<GameSummary | undefined>(match?.summary);
  const [isEditing, setIsEditing] = useState(false);
  const [editedShots, setEditedShots] = useState<Record<string, Record<string, string>>>({}); // { [period]: { [playerId]: count } }

  useEffect(() => {
    if (isOpen) {
      setLocalSummary(match?.summary);
      setIsEditing(false);
      setEditedShots({});
    }
  }, [isOpen, match]);
  
  const homeTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.homeTeamId), [tournament, match]);
  const awayTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.awayTeamId), [tournament, match]);
  const categoryName = useMemo(() => getCategoryNameById(match?.categoryId || '', tournament?.categories), [match, tournament]);

  const allPeriodTexts = useMemo(() => {
    if (!localSummary?.statsByPeriod) return [];
    const periods = Object.keys(localSummary.statsByPeriod);
    return periods.sort((a, b) => {
      if (a.startsWith('OT') && !b.startsWith('OT')) return 1;
      if (!a.startsWith('OT') && b.startsWith('OT')) return -1;
      return a.localeCompare(b);
    });
  }, [localSummary]);

  const aggregatedStats = useMemo(() => {
    const calculateTotals = (team: 'home' | 'away') => {
        if (!localSummary) return { goals: [], penalties: [], playerStats: [] };
        
        const allGoals = localSummary[team]?.goals || [];
        const allPenalties = localSummary[team]?.penalties || [];
        
        const playerStatsMap = new Map<string, SummaryPlayerStats>();
        
        (localSummary.attendance?.[team] || []).forEach(p => {
            playerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 });
        });

        Object.values(localSummary.statsByPeriod || {}).forEach(period => {
            (period[team]?.playerStats || []).forEach(pStat => {
                const player = playerStatsMap.get(pStat.id);
                if (player) {
                    player.goals += pStat.goals || 0;
                    player.assists += pStat.assists || 0;
                    player.shots += pStat.shots || 0;
                }
            });
        });

        return {
            goals: allGoals,
            penalties: allPenalties,
            playerStats: Array.from(playerStatsMap.values()),
        };
    };

    return {
      home: calculateTotals('home'),
      away: calculateTotals('away'),
    };
  }, [localSummary]);

  const handleEditClick = () => {
    if (!localSummary?.statsByPeriod) return;
    const initialShots: Record<string, Record<string, string>> = {};
    for (const period in localSummary.statsByPeriod) {
        initialShots[period] = {};
        for(const team of ['home', 'away'] as const) {
            localSummary.statsByPeriod[period][team].playerStats.forEach(p => {
                initialShots[period][p.id] = String(p.shots || 0);
            });
        }
    }
    setEditedShots(initialShots);
    setIsEditing(true);
  };
  
  const handleCancelClick = () => setIsEditing(false);

  const handleSaveClick = () => {
    if (!localSummary || !match || !tournament) return;
    
    let hasChanges = false;
    const newSummary = JSON.parse(JSON.stringify(localSummary));

    for (const period in editedShots) {
        for (const team of ['home', 'away'] as const) {
            (newSummary.statsByPeriod[period][team].playerStats as SummaryPlayerStats[]).forEach(pStat => {
                const newShotCountStr = editedShots[period]?.[pStat.id];
                if (newShotCountStr !== undefined) {
                    const newShotCount = parseInt(newShotCountStr, 10);
                    if (!isNaN(newShotCount) && newShotCount !== pStat.shots) {
                        pStat.shots = newShotCount;
                        hasChanges = true;
                    }
                }
            });
        }
    }

    if(hasChanges) {
        dispatch({
            type: 'SAVE_MATCH_SUMMARY',
            payload: { matchId: match.id, summary: newSummary }
        });
        setLocalSummary(newSummary);
        toast({ title: "Resumen Guardado", description: "Los cambios en los tiros han sido guardados."});
    } else {
        toast({ title: "Sin Cambios", description: "No se detectaron modificaciones en los tiros."});
    }

    setIsEditing(false);
  };

  const handleShotInputChange = (period: string, playerId: string, value: string) => {
    setEditedShots(prev => ({
        ...prev,
        [period]: {
            ...prev[period],
            [playerId]: value,
        }
    }));
  };


  if (!match || !tournament || !localSummary) return null;
  
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Resumen de Partido Jugado</DialogTitle>
          <DialogDescription>
            {homeTeam?.name || '?'} vs {awayTeam?.name || '?'} - Cat: {categoryName}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 text-center my-2">
            <h3 className="text-2xl font-bold text-primary">{homeTeam?.name} - <span className="text-accent">{aggregatedStats.home.goals.length}</span></h3>
            <h3 className="text-2xl font-bold text-primary">{awayTeam?.name} - <span className="text-accent">{aggregatedStats.away.goals.length}</span></h3>
        </div>

        <ScrollArea className="flex-grow my-2 border-t pt-4 pr-6 -mr-6">
          <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                      <GoalsSection teamName={homeTeam?.name || ''} goals={aggregatedStats.home.goals} />
                      <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={aggregatedStats.home.penalties} />
                      <PlayerStatsSection teamName={homeTeam?.name || ''} playerStats={aggregatedStats.home.playerStats} />
                  </div>
                  <div className="space-y-4">
                       <GoalsSection teamName={awayTeam?.name || ''} goals={aggregatedStats.away.goals} />
                       <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={aggregatedStats.away.penalties} />
                       <PlayerStatsSection teamName={awayTeam?.name || ''} playerStats={aggregatedStats.away.playerStats} />
                  </div>
              </div>
              
               {localSummary.shootout && (localSummary.shootout.homeAttempts.length > 0 || localSummary.shootout.awayAttempts.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ShootoutSection teamName={homeTeam?.name || ''} attempts={localSummary.shootout.homeAttempts} />
                        <ShootoutSection teamName={awayTeam?.name || ''} attempts={localSummary.shootout.awayAttempts} />
                    </div>
                )}
              
              {allPeriodTexts.length > 0 && (
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="periods">
                        <AccordionTrigger className="text-xl">
                             <div className="flex items-center justify-between w-full pr-2">
                                <span>Detalle por Período</span>
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
                        </AccordionTrigger>
                        <AccordionContent className="space-y-6 pl-2">
                            {allPeriodTexts.map(periodText => {
                                const periodStats = localSummary.statsByPeriod![periodText];
                                return (
                                    <div key={periodText} className="space-y-4 border-l-2 pl-4 ml-2">
                                        <h3 className="text-lg font-semibold">{periodText}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <PlayerStatsSection teamName={homeTeam?.name || ''} playerStats={periodStats.home.playerStats} editable={isEditing} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
                                            <PlayerStatsSection teamName={awayTeam?.name || ''} playerStats={periodStats.away.playerStats} editable={isEditing} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
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
  );
}
