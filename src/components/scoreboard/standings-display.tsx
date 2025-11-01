
"use client";

import React, { useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Info } from 'lucide-react';
import type { Team } from '@/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { useStandings } from '@/hooks/use-standings';

export function StandingsDisplay() {
  const { state } = useGameState();
  const { tournaments, selectedTournamentId, selectedMatchCategory } = state.config;
  const { matchId } = state.live;

  const currentTournament = useMemo(() => {
    return (tournaments || []).find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const currentMatch = useMemo(() => {
    if (!currentTournament || !matchId || !currentTournament.matches) return null;
    return currentTournament.matches.find(m => m.id === matchId);
  }, [currentTournament, matchId]);
  
  const standings = useStandings(currentTournament, selectedMatchCategory);

  const displayedStandings = useMemo(() => {
    if (!currentMatch || standings.length <= 5) {
        return standings;
    }

    const homeTeamId = currentMatch.homeTeamId;
    const awayTeamId = currentMatch.awayTeamId;

    const homeIndex = standings.findIndex(s => s.id === homeTeamId);
    const awayIndex = standings.findIndex(s => s.id === awayTeamId);

    if (homeIndex === -1 || awayIndex === -1) {
        return standings.slice(0, 5); // Fallback sensible
    }

    const indicesToShow = new Set<number>();
    
    [homeIndex, awayIndex].forEach(index => {
        indicesToShow.add(index);
        if (index > 0) indicesToShow.add(index - 1);
        if (index < standings.length - 1) indicesToShow.add(index + 1);
    });

    const sortedIndices = Array.from(indicesToShow).sort((a,b) => a - b);
    
    const finalRows: (any | { isEllipsis: true })[] = [];
    let lastIndex = -1;

    sortedIndices.forEach(index => {
        if (lastIndex !== -1 && index > lastIndex + 1) {
            finalRows.push({ isEllipsis: true, id: `ellipsis-${lastIndex}` });
        }
        finalRows.push(standings[index]);
        lastIndex = index;
    });

    return finalRows;

  }, [standings, currentMatch]);


  if (!currentMatch) return null;
  const homeTeamId = currentMatch.homeTeamId;
  const awayTeamId = currentMatch.awayTeamId;

  const headerClass = "text-base lg:text-lg";
  const cellClass = "text-base lg:text-xl py-2";

  return (
    <Card className="bg-card shadow-lg flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl md:text-2xl lg:text-3xl">
          <Trophy className="h-6 w-6 lg:h-8 lg:w-8 text-amber-400" />
          Tabla de Posiciones
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={cn("text-center", headerClass)}>Puesto</TableHead>
                <TableHead className={cn("w-1/2", headerClass)}>Equipo</TableHead>
                <TableHead className={cn("text-center", headerClass)}>PJ</TableHead>
                <TableHead className={cn("text-center", headerClass)}>PG</TableHead>
                <TableHead className={cn("text-center", headerClass)}>PE</TableHead>
                <TableHead className={cn("text-center", headerClass)}>PP</TableHead>
                <TableHead className={cn("text-center border-l", headerClass)}>GF</TableHead>
                <TableHead className={cn("text-center", headerClass)}>GC</TableHead>
                <TableHead className={cn("text-center font-bold border-l", headerClass)}>Puntos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedStandings.map(teamStat => {
                if (teamStat.isEllipsis) {
                    return (
                        <TableRow key={teamStat.id}>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-0 h-10 text-2xl tracking-widest">
                                ...
                            </TableCell>
                        </TableRow>
                    );
                }
                
                const isMatchTeam = teamStat.id === homeTeamId || teamStat.id === awayTeamId;
                
                return (
                    <TableRow key={teamStat.id} className={cn(isMatchTeam && "bg-primary/20 text-foreground font-bold", "text-lg")}>
                        <TableCell className={cn("text-center font-bold", cellClass)}>{teamStat.rank}</TableCell>
                        <TableCell className={cn("font-medium", cellClass)}>{teamStat.name}</TableCell>
                        <TableCell className={cn("text-center", cellClass)}>{teamStat.pj}</TableCell>
                        <TableCell className={cn("text-center", cellClass)}>{teamStat.pg + teamStat.pg_ot}</TableCell>
                        <TableCell className={cn("text-center", cellClass)}>{teamStat.pe}</TableCell>
                        <TableCell className={cn("text-center", cellClass)}>{teamStat.pp + teamStat.pp_ot}</TableCell>
                        <TableCell className={cn("text-center border-l", cellClass)}>{teamStat.gf}</TableCell>
                        <TableCell className={cn("text-center", cellClass)}>{teamStat.gc}</TableCell>
                        <TableCell className={cn("text-center font-bold text-xl lg:text-2xl border-l", cellClass)}>{teamStat.puntos}</TableCell>
                    </TableRow>
                )
              })}
              {displayedStandings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">No hay datos de posiciones.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
