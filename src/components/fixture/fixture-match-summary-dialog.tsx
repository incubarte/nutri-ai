
"use client";

import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import type { MatchData, Tournament } from "@/types";
import { getCategoryNameById } from "@/contexts/game-state-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GoalsSection } from "../summary/goals-section";
import { PenaltiesSection } from "../summary/penalties-section";
import { PlayerStatsSection } from "../summary/player-stats-section";
import { ShootoutSection } from "../summary/shootout-section";

interface FixtureMatchSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  match: MatchData | null;
  tournament: Tournament | null;
}

export function FixtureMatchSummaryDialog({ isOpen, onOpenChange, match, tournament }: FixtureMatchSummaryDialogProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  const homeTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.homeTeamId), [tournament, match]);
  const awayTeam = useMemo(() => tournament?.teams.find(t => t.id === match?.awayTeamId), [tournament, match]);
  const categoryName = useMemo(() => getCategoryNameById(match?.categoryId || '', tournament?.categories), [match, tournament]);

  const allPeriodTexts = useMemo(() => {
    if (!match?.summary?.statsByPeriod) return [];
    const periods = Object.keys(match.summary.statsByPeriod);
    
    // This is a simplified sort; a more complex one might be needed if OT periods are not named sequentially
    return periods.sort((a, b) => {
        if (a.startsWith('OT') && !b.startsWith('OT')) return 1;
        if (!a.startsWith('OT') && b.startsWith('OT')) return -1;
        return a.localeCompare(b);
    });
  }, [match?.summary?.statsByPeriod]);

  // Aggregate stats need to react to changes.
  const aggregatedStats = useMemo(() => {
    const calculateTotals = (team: 'home' | 'away') => {
      const allGoals = match?.summary?.[team]?.goals || [];
      const allPenalties = match?.summary?.[team]?.penalties || [];
      
      const playerStatsMap = new Map<string, { shots: number; goals: number; assists: number }>();
      
      (match?.summary?.attendance?.[team] || []).forEach(p => {
        playerStatsMap.set(p.id, { shots: 0, goals: 0, assists: 0 });
      });

      Object.values(match?.summary?.statsByPeriod || {}).forEach(period => {
          (period[team]?.playerStats || []).forEach(pStat => {
              if (playerStatsMap.has(pStat.id)) {
                  const current = playerStatsMap.get(pStat.id)!;
                  current.shots += pStat.shots || 0;
                  current.goals += pStat.goals || 0;
                  current.assists += pStat.assists || 0;
              }
          });
      });

      const finalPlayerStats = (match?.summary?.attendance?.[team] || []).map(p => {
          const stats = playerStatsMap.get(p.id);
          return { ...p, ...stats };
      });

      return {
          goals: allGoals,
          penalties: allPenalties,
          playerStats: finalPlayerStats
      };
    };

    return {
      home: calculateTotals('home'),
      away: calculateTotals('away'),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.summary, refreshKey]);


  if (!match || !tournament) return null;
  
  const homeGoals = aggregatedStats.home.goals;
  const awayGoals = aggregatedStats.away.goals;
  const homePenalties = aggregatedStats.home.penalties;
  const awayPenalties = aggregatedStats.away.penalties;
  const homePlayerStats = aggregatedStats.home.playerStats;
  const awayPlayerStats = aggregatedStats.away.playerStats;
  const homeAttendance = match.summary?.attendance?.home || [];
  const awayAttendance = match.summary?.attendance?.away || [];
  const shootout = match.summary?.shootout;

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
            <h3 className="text-2xl font-bold text-primary">{homeTeam?.name} - <span className="text-accent">{homeGoals.length}</span></h3>
            <h3 className="text-2xl font-bold text-primary">{awayTeam?.name} - <span className="text-accent">{awayGoals.length}</span></h3>
        </div>

        <ScrollArea className="flex-grow my-2 border-t pt-4 pr-6 -mr-6">
          <div className="space-y-6">
              {/* Totales */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                      <GoalsSection teamName={homeTeam?.name || ''} goals={homeGoals} />
                      <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={homePenalties} />
                      <PlayerStatsSection team="home" teamName={homeTeam?.name || ''} playerStats={homePlayerStats} attendance={homeAttendance} />
                  </div>
                  <div className="space-y-4">
                       <GoalsSection teamName={awayTeam?.name || ''} goals={awayGoals} />
                       <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={awayPenalties} />
                       <PlayerStatsSection team="away" teamName={awayTeam?.name || ''} playerStats={awayPlayerStats} attendance={awayAttendance} />
                  </div>
              </div>
              
               {shootout && (shootout.homeAttempts.length > 0 || shootout.awayAttempts.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <ShootoutSection teamName={homeTeam?.name || ''} attempts={shootout.homeAttempts} />
                        <ShootoutSection teamName={awayTeam?.name || ''} attempts={shootout.awayAttempts} />
                    </div>
                )}
              
              {/* Desglose por período */}
              {allPeriodTexts.length > 0 && (
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="periods">
                        <AccordionTrigger className="text-xl">Detalle por Período</AccordionTrigger>
                        <AccordionContent className="space-y-6 pl-2">
                            {allPeriodTexts.map(periodText => {
                                const periodStats = match.summary!.statsByPeriod![periodText];
                                return (
                                    <div key={periodText} className="space-y-4 border-l-2 pl-4 ml-2">
                                        <h3 className="text-lg font-semibold">{periodText}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-4">
                                                <PlayerStatsSection 
                                                    team="home" 
                                                    teamName={homeTeam?.name || ''} 
                                                    playerStats={periodStats.home.playerStats} 
                                                    attendance={homeAttendance} 
                                                    editable={true} 
                                                    periodText={periodText}
                                                    onEdit={() => setRefreshKey(k => k + 1)} 
                                                />
                                            </div>
                                            <div className="space-y-4">
                                                <PlayerStatsSection 
                                                    team="away" 
                                                    teamName={awayTeam?.name || ''} 
                                                    playerStats={periodStats.away.playerStats} 
                                                    attendance={awayAttendance} 
                                                    editable={true} 
                                                    periodText={periodText} 
                                                    onEdit={() => setRefreshKey(k => k + 1)}
                                                />
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
  );
}
