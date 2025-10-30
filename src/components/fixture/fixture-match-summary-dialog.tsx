

"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Edit3, Check, XCircle } from "lucide-react";
import type { MatchData, Tournament, GameSummary, SummaryPlayerStats, PlayerData } from "@/types";
import { useGameState, getCategoryNameById } from "@/contexts/game-state-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GoalsSection } from "../summary/goals-section";
import { PenaltiesSection } from "../summary/penalties-section";
import { PlayerStatsSection } from "../summary/player-stats-section";
import { ShootoutSection } from "../summary/shootout-section";
import { useToast } from "@/hooks/use-toast";
import { Input } from "../ui/input";
import { Separator } from "../ui/separator";

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
  const [editedShots, setEditedShots] = useState<Record<string, Record<string, string>>>({});
  const [refreshKey, setRefreshKey] = useState(0);

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
    if (!localSummary?.statsByPeriod) return [];
    const periods = Object.keys(localSummary.statsByPeriod);
    if (localSummary.shootout && (localSummary.shootout.homeAttempts.length > 0 || localSummary.shootout.awayAttempts.length > 0)) {
       // Shootout is handled separately, not as a period
    }
    return periods.sort((a, b) => {
      if (a.startsWith('OT') && !b.startsWith('OT')) return 1;
      if (!a.startsWith('OT') && b.startsWith('OT')) return -1;
      return a.localeCompare(b);
    });
  }, [localSummary]);

  const aggregatedStats = useMemo(() => {
    const calculateTotals = (teamType: 'home' | 'away') => {
        if (!localSummary) return { goals: [], penalties: [], playerStats: [] };
        
        const teamData = teamType === 'home' ? homeTeam : awayTeam;
        const allGoals = localSummary[teamType]?.goals || [];
        const allPenalties = localSummary[teamType]?.penalties || [];
        
        const playerStatsMap = new Map<string, SummaryPlayerStats>();
        
        (teamData?.players || []).forEach(p => {
            playerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 });
        });

        Object.values(localSummary.statsByPeriod || {}).forEach(period => {
            (period[teamType]?.playerStats || []).forEach(pStat => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSummary, homeTeam, awayTeam, refreshKey]);

  const handleEditClick = () => {
    const initialShots: Record<string, Record<string, string>> = {};
    if (localSummary?.statsByPeriod) {
        for (const period in localSummary.statsByPeriod) {
            initialShots[period] = {};
            for(const team of ['home', 'away'] as const) {
                const playersForTeam = team === 'home' ? homeTeam?.players : awayTeam?.players;
                playersForTeam?.forEach(p => {
                    const stat = localSummary.statsByPeriod![period][team].playerStats.find(ps => ps.id === p.id);
                    initialShots[period][p.id] = String(stat?.shots || 0);
                });
            }
        }
    }
    setEditedShots(initialShots);
    setIsEditing(true);
  };
  
  const handleCancelClick = () => setIsEditing(false);

  const handleSaveClick = () => {
    if (!localSummary || !match || !tournament) return;
    
    const newSummary = JSON.parse(JSON.stringify(localSummary));

    for (const periodText in editedShots) {
        for (const team of ['home', 'away'] as const) {
            const teamPlayers = team === 'home' ? (homeTeam?.players || []) : (awayTeam?.players || []);
            teamPlayers.forEach(player => {
                if (editedShots[periodText]?.[player.id] !== undefined) {
                    const newShotCount = parseInt(editedShots[periodText][player.id], 10) || 0;
                    
                    if (!newSummary.statsByPeriod[periodText]) {
                         newSummary.statsByPeriod[periodText] = { home: { goals:[], playerStats:[] }, away: { goals:[], playerStats:[] } };
                    }
                    let periodStats = newSummary.statsByPeriod[periodText][team].playerStats as SummaryPlayerStats[];
                    let playerStat = periodStats.find(p => p.id === player.id);
                    if (playerStat) {
                        playerStat.shots = newShotCount;
                    } else {
                        periodStats.push({ id: player.id, name: player.name, number: player.number, shots: newShotCount, goals: 0, assists: 0 });
                    }
                }
            });
        }
    }

    dispatch({
        type: 'SAVE_MATCH_SUMMARY',
        payload: { matchId: match.id, summary: newSummary }
    });
    setLocalSummary(newSummary);
    setRefreshKey(k => k + 1);
    toast({ title: "Resumen Guardado", description: "Los cambios en los tiros han sido guardados."});

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
                <GoalsSection teamName={homeTeam?.name || ''} goals={aggregatedStats.home.goals} />
                <GoalsSection teamName={awayTeam?.name || ''} goals={aggregatedStats.away.goals} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PenaltiesSection team="home" teamName={homeTeam?.name || ''} penalties={aggregatedStats.home.penalties} />
                  <PenaltiesSection team="away" teamName={awayTeam?.name || ''} penalties={aggregatedStats.away.penalties} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PlayerStatsSection teamName={homeTeam?.name || ''} allPlayers={homeTeam?.players} playerStats={aggregatedStats.home.playerStats} attendance={localSummary.attendance.home} />
                  <PlayerStatsSection teamName={awayTeam?.name || ''} allPlayers={awayTeam?.players} playerStats={aggregatedStats.away.playerStats} attendance={localSummary.attendance.away} />
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
                                        <Edit3 className="mr-2 h-4 w-4"/>Editar Tiros
                                    </Button>
                                )}
                            </div>
                            {allPeriodTexts.map(periodText => {
                                const periodStats = localSummary.statsByPeriod?.[periodText];
                                return (
                                    <div key={periodText} className="space-y-4 border-l-2 pl-4 ml-2">
                                        <h3 className="text-lg font-semibold">{periodText}</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <PlayerStatsSection teamName={homeTeam?.name || ''} allPlayers={homeTeam?.players} playerStats={periodStats?.home.playerStats} attendance={localSummary.attendance.home} editable={isEditing} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
                                            <PlayerStatsSection teamName={awayTeam?.name || ''} allPlayers={awayTeam?.players} playerStats={periodStats?.away.playerStats} attendance={localSummary.attendance.away} editable={isEditing} editedShots={editedShots[periodText]} onShotChange={(playerId, value) => handleShotInputChange(periodText, playerId, value)} />
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
