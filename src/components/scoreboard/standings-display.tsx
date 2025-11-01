
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
    if (!currentMatch || standings.length === 0) return standings;

    const homeTeamId = currentMatch.homeTeamId;
    const awayTeamId = currentMatch.awayTeamId;

    const homeIndex = standings.findIndex(s => s.id === homeTeamId);
    const awayIndex = standings.findIndex(s => s.id === awayTeamId);

    if (homeIndex === -1 || awayIndex === -1) return standings;

    const indicesToShow = new Set<number>();

    const addWithNeighbors = (index: number) => {
        indicesToShow.add(index);
        if (index > 0) indicesToShow.add(index - 1);
        if (index > 1) indicesToShow.add(index - 2);
        if (index < standings.length - 1) indicesToShow.add(index + 1);
        if (index < standings.length - 2) indicesToShow.add(index + 2);
    };

    addWithNeighbors(homeIndex);
    addWithNeighbors(awayIndex);

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
    
    if (sortedIndices[0] > 0) {
        finalRows.unshift({ isEllipsis: true, id: 'ellipsis-start' });
    }
    if (lastIndex < standings.length - 1) {
        finalRows.push({ isEllipsis: true, id: 'ellipsis-end' });
    }

    return finalRows;

  }, [standings, currentMatch]);


  if (!currentMatch) return null;
  const homeTeamId = currentMatch.homeTeamId;
  const awayTeamId = currentMatch.awayTeamId;

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
                <TableHead className="text-center">Puesto</TableHead>
                <TableHead className="w-1/2">Equipo</TableHead>
                <TableHead className="text-center">PJ</TableHead>
                <TableHead className="text-center">PG</TableHead>
                <TableHead className="text-center">PE</TableHead>
                <TableHead className="text-center">PP</TableHead>
                <TableHead className="text-center border-l">GF</TableHead>
                <TableHead className="text-center">GC</TableHead>
                <TableHead className="text-center font-bold border-l">Puntos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedStandings.map(teamStat => {
                if (teamStat.isEllipsis) {
                    return (
                        <TableRow key={teamStat.id}>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-1">
                                ...
                            </TableCell>
                        </TableRow>
                    );
                }
                
                const isMatchTeam = teamStat.id === homeTeamId || teamStat.id === awayTeamId;
                
                return (
                    <TableRow key={teamStat.id} className={cn(isMatchTeam && "bg-primary/20 text-foreground font-bold")}>
                        <TableCell className="text-center font-bold">{teamStat.rank}</TableCell>
                        <TableCell className="font-medium">{teamStat.name}</TableCell>
                        <TableCell className="text-center">{teamStat.pj}</TableCell>
                        <TableCell className="text-center">{teamStat.pg + teamStat.pg_ot}</TableCell>
                        <TableCell className="text-center">{teamStat.pe}</TableCell>
                        <TableCell className="text-center">{teamStat.pp + teamStat.pp_ot}</TableCell>
                        <TableCell className="text-center border-l">{teamStat.gf}</TableCell>
                        <TableCell className="text-center">{teamStat.gc}</TableCell>
                        <TableCell className="text-center font-bold text-lg border-l">{teamStat.puntos}</TableCell>
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
