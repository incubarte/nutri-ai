
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

interface StandingsDisplayProps {
  teamContext: Team;
}

export function StandingsDisplay({ teamContext }: StandingsDisplayProps) {
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

  const teamIdToShow = teamContext === 'home' ? currentMatch?.homeTeamId : currentMatch?.awayTeamId;
  const teamToShow = (currentTournament?.teams || []).find(t => t.id === teamIdToShow);
  
  const standings = useStandings(currentTournament, selectedMatchCategory);

  if (!teamToShow) return null;

  return (
    <Card className="bg-card shadow-lg flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-xl">
          <Trophy className="h-6 w-6 text-amber-400" />
          Tabla de Posiciones - {teamToShow.name}
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
                <TableHead className="text-center">GF</TableHead>
                <TableHead className="text-center">GC</TableHead>
                <TableHead className="text-center font-bold">Puntos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map(teamStat => (
                <TableRow key={teamStat.id} className={cn(teamStat.id === teamIdToShow && "bg-primary/20 text-foreground font-bold")}>
                  <TableCell className="text-center font-bold">{teamStat.rank}</TableCell>
                  <TableCell className="font-medium">{teamStat.name}</TableCell>
                  <TableCell className="text-center">{teamStat.pj}</TableCell>
                  <TableCell className="text-center">{teamStat.pg + teamStat.pg_ot}</TableCell>
                  <TableCell className="text-center">{teamStat.pe}</TableCell>
                  <TableCell className="text-center">{teamStat.pp + teamStat.pp_ot}</TableCell>
                  <TableCell className="text-center">{teamStat.gf}</TableCell>
                  <TableCell className="text-center">{teamStat.gc}</TableCell>
                  <TableCell className="text-center font-bold text-lg">{teamStat.puntos}</TableCell>
                </TableRow>
              ))}
              {standings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">No hay datos de posiciones.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
