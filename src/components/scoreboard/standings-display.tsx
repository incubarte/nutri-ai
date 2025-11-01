
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
  const { tournaments, selectedTournamentId, selectedMatchCategory, scoreboardLayout } = state.config;
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
    if (!currentMatch) {
      return standings;
    }
    
    if (standings.length <= 5) {
      return standings;
    }

    const homeTeamId = currentMatch.homeTeamId;
    const awayTeamId = currentMatch.awayTeamId;

    const homeIndex = standings.findIndex(s => s.id === homeTeamId);
    const awayIndex = standings.findIndex(s => s.id === awayTeamId);
    
    if (homeIndex === -1 || awayIndex === -1) {
        return standings.slice(0, 5);
    }
    
    const indicesToShow = new Set<number>();
    
    // Add teams around the first team
    if(homeIndex > 0) indicesToShow.add(homeIndex - 1);
    indicesToShow.add(homeIndex);
    if(homeIndex < standings.length - 1) indicesToShow.add(homeIndex + 1);

    // Add teams around the second team
    if(awayIndex > 0) indicesToShow.add(awayIndex - 1);
    indicesToShow.add(awayIndex);
    if(awayIndex < standings.length - 1) indicesToShow.add(awayIndex + 1);
    
    const sortedIndices = Array.from(indicesToShow).sort((a,b) => a - b);
    
    const finalRows: (any | { isEllipsis: true, id: string })[] = [];
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


  if (!currentMatch || !scoreboardLayout) return null;
  const homeTeamId = currentMatch.homeTeamId;
  const awayTeamId = currentMatch.awayTeamId;

  // Base font size from config
  const baseFontSizeRem = scoreboardLayout.standingsTableFontSize || 1;
  const rowHeightRem = scoreboardLayout.standingsTableRowHeight || 3;

  // Proportional sizes based on the base
  const titleSize = baseFontSizeRem * 2;
  const headerSize = baseFontSizeRem * 1.1;
  const cellSize = baseFontSizeRem;
  const pointsSize = baseFontSizeRem * 1.25;
  const ellipsisRowHeight = rowHeightRem * 0.7; // Make ellipsis row a bit shorter
  const ellipsisFontSize = baseFontSizeRem * 2.5;


  return (
    <Card className="bg-card shadow-lg flex flex-col h-full">
      <CardHeader>
        <CardTitle 
          className="flex items-center gap-3"
          style={{ fontSize: `${titleSize}rem` }}
        >
          <Trophy className="h-[1em] w-[1em] text-amber-400" />
          Tabla de Posiciones
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow overflow-hidden">
        <ScrollArea className="h-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem`, height: `${rowHeightRem}rem` }}>Puesto</TableHead>
                <TableHead className="w-1/2" style={{ fontSize: `${headerSize}rem` }}>Equipo</TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem` }}>PJ</TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem` }}>PG</TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem` }}>PG <span className="text-[0.7em] opacity-80">(OT)</span></TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem` }}>PP <span className="text-[0.7em] opacity-80">(OT)</span></TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem` }}>PE</TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem` }}>PP</TableHead>
                <TableHead className="text-center border-l" style={{ fontSize: `${headerSize}rem` }}>GF</TableHead>
                <TableHead className="text-center" style={{ fontSize: `${headerSize}rem` }}>GC</TableHead>
                <TableHead className="text-center font-bold border-l" style={{ fontSize: `${headerSize}rem` }}>Puntos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedStandings.map(teamStat => {
                if (teamStat.isEllipsis) {
                    return (
                        <TableRow key={teamStat.id}>
                            <TableCell colSpan={11} className="text-center text-muted-foreground/50 tracking-widest align-middle" style={{ fontSize: `${ellipsisFontSize}rem`, height: `${ellipsisRowHeight}rem`, lineHeight: '0' }}>
                                ...
                            </TableCell>
                        </TableRow>
                    );
                }
                
                const isMatchTeam = teamStat.id === homeTeamId || teamStat.id === awayTeamId;
                
                return (
                    <TableRow key={teamStat.id} className={cn(isMatchTeam ? "bg-primary/20 font-bold" : "text-muted-foreground/80 opacity-80")} style={{ fontSize: `${cellSize}rem`, height: `${rowHeightRem}rem`}}>
                        <TableCell className="text-center font-bold">{teamStat.rank}</TableCell>
                        <TableCell className="font-medium">{teamStat.name}</TableCell>
                        <TableCell className="text-center">{teamStat.pj}</TableCell>
                        <TableCell className="text-center">{teamStat.pg}</TableCell>
                        <TableCell className="text-center">{teamStat.pg_ot}</TableCell>
                        <TableCell className="text-center">{teamStat.pp_ot}</TableCell>
                        <TableCell className="text-center">{teamStat.pe}</TableCell>
                        <TableCell className="text-center">{teamStat.pp}</TableCell>
                        <TableCell className="text-center border-l">{teamStat.gf}</TableCell>
                        <TableCell className="text-center">{teamStat.gc}</TableCell>
                        <TableCell className="text-center font-bold border-l" style={{ fontSize: `${pointsSize}rem`}}>{teamStat.puntos}</TableCell>
                    </TableRow>
                )
              })}
              {displayedStandings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center">No hay datos de posiciones.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
