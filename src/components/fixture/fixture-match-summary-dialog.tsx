
"use client";

import React, { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Goal, Siren, BarChart3, X } from "lucide-react";
import type { MatchData, Tournament, GoalLog, PenaltyLog, SummaryPlayerStats } from "@/types";
import { formatTime, getCategoryNameById, getEndReasonText } from "@/contexts/game-state-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";

interface FixtureMatchSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  match: MatchData | null;
  tournament: Tournament | null;
}

const GoalsSection = ({ goals }: { goals: GoalLog[] }) => {
    return (
        <Card>
            <CardHeader className="p-4"><CardTitle className="text-lg flex items-center gap-2"><Goal className="h-4 w-4"/>Goles</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
                {goals.length > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Tiempo</TableHead><TableHead>Gol</TableHead><TableHead>Asist.</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {goals.map(goal => (
                                <TableRow key={goal.id}><TableCell>{formatTime(goal.gameTime)} - {goal.periodText}</TableCell><TableCell>#{goal.scorer?.playerNumber}</TableCell><TableCell>#{goal.assist?.playerNumber || '---'}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : <p className="text-sm text-muted-foreground">Sin goles.</p>}
            </CardContent>
        </Card>
    );
};

const PenaltiesSection = ({ penalties }: { penalties: PenaltyLog[] }) => {
    return (
        <Card>
            <CardHeader className="p-4"><CardTitle className="text-lg flex items-center gap-2"><Siren className="h-4 w-4"/>Penalidades</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
                {penalties.length > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>Tiempo</TableHead><TableHead>Jugador</TableHead><TableHead>Falta</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {penalties.map(p => (
                                <TableRow key={p.id}><TableCell>{formatTime(p.addGameTime)} - {p.addPeriodText}</TableCell><TableCell>#{p.playerNumber}</TableCell><TableCell className="text-xs">{p.penaltyName}</TableCell><TableCell className="text-xs">{getEndReasonText(p.endReason)}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : <p className="text-sm text-muted-foreground">Sin penalidades.</p>}
            </CardContent>
        </Card>
    );
};

const PlayerStatsSection = ({ playerStats, attendance }: { playerStats: SummaryPlayerStats[], attendance: any[] }) => {
    const statsArray = useMemo(() => {
        if (!attendance) return [];
        return attendance.map(p => ({
            ...p,
            stats: playerStats.find((s: any) => s.id === p.id) || { goals: 0, assists: 0, shots: 0 }
        })).sort((a, b) => parseInt(a.number, 10) - parseInt(b.number, 10));
    }, [playerStats, attendance]);

    return (
        <Card>
            <CardHeader className="p-4"><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-4 w-4"/>Estadísticas</CardTitle></CardHeader>
            <CardContent className="p-4 pt-0">
                {statsArray.length > 0 ? (
                    <Table>
                        <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Nombre</TableHead><TableHead>G</TableHead><TableHead>A</TableHead><TableHead>T</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {statsArray.map(p => (
                                <TableRow key={p.id}><TableCell>{p.number}</TableCell><TableCell className="truncate text-xs">{p.name}</TableCell><TableCell>{p.stats.goals}</TableCell><TableCell>{p.stats.assists}</TableCell><TableCell>{p.stats.shots}</TableCell></TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : <p className="text-sm text-muted-foreground">Sin jugadores.</p>}
            </CardContent>
        </Card>
    );
};

export function FixtureMatchSummaryDialog({ isOpen, onOpenChange, match, tournament }: FixtureMatchSummaryDialogProps) {
  if (!match || !tournament) return null;

  const homeTeam = tournament.teams.find(t => t.id === match.homeTeamId);
  const awayTeam = tournament.teams.find(t => t.id === match.awayTeamId);
  const categoryName = getCategoryNameById(match.categoryId, tournament.categories);

  const homeGoals = match.summary?.home?.goals || [];
  const awayGoals = match.summary?.away?.goals || [];
  const homePenalties = match.summary?.home?.penalties || [];
  const awayPenalties = match.summary?.away?.penalties || [];
  const homePlayerStats = match.summary?.home?.playerStats || [];
  const awayPlayerStats = match.summary?.away?.playerStats || [];
  const homeAttendance = match.summary?.attendance?.home || [];
  const awayAttendance = match.summary?.attendance?.away || [];
  
  const allPeriodTexts = useMemo(() => {
    if (!match.summary?.statsByPeriod) return [];
    const periods = Object.keys(match.summary.statsByPeriod);
    return periods.sort((a,b) => {
        const getPeriodNumber = (text: string) => {
            if (text.startsWith('OT')) return 100 + parseInt(text.replace('OT', '') || '1', 10);
            return parseInt(text.replace(/\D/g, ''), 10);
        };
        return getPeriodNumber(a) - getPeriodNumber(b);
    });
  }, [match.summary?.statsByPeriod]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">Resumen de Partido Jugado</DialogTitle>
          <DialogDescription>
            {homeTeam?.name} vs {awayTeam?.name} - Cat: {categoryName}
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
                      <GoalsSection goals={homeGoals} />
                      <PenaltiesSection penalties={homePenalties} />
                      <PlayerStatsSection playerStats={homePlayerStats} attendance={homeAttendance} />
                  </div>
                  <div className="space-y-4">
                       <GoalsSection goals={awayGoals} />
                       <PenaltiesSection penalties={awayPenalties} />
                       <PlayerStatsSection playerStats={awayPlayerStats} attendance={awayAttendance} />
                  </div>
              </div>
              <Separator />
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
                                                <GoalsSection goals={periodStats.home.goals} />
                                                <PenaltiesSection penalties={periodStats.home.penalties} />
                                                <PlayerStatsSection playerStats={periodStats.home.playerStats} attendance={homeAttendance} />
                                            </div>
                                            <div className="space-y-4">
                                                <GoalsSection goals={periodStats.away.goals} />
                                                <PenaltiesSection penalties={periodStats.away.penalties} />
                                                <PlayerStatsSection playerStats={periodStats.away.playerStats} attendance={awayAttendance} />
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
