"use client";

import React, { useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy } from 'lucide-react';
import type { TeamData, Team } from '@/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

interface TeamStats {
  id: string;
  name: string;
  pj: number; // Partidos Jugados
  pg: number; // Partidos Ganados en tiempo regular
  pe: number; // Partidos Empatados
  pp: number; // Partidos Perdidos en tiempo regular
  pg_ot: number; // Partidos Ganados en OT/SO
  pp_ot: number; // Partidos Perdidos en OT/SO
  gf: number; // Goles a Favor
  gc: number; // Goles en Contra
  puntos: number;
}

interface StandingsDisplayProps {
  teamContext: Team;
}

export function StandingsDisplay({ teamContext }: StandingsDisplayProps) {
  const { state } = useGameState();
  const { tournaments, selectedTournamentId, selectedMatchCategory } = state.config;
  const { matchId } = state.live;

  const currentTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const currentMatch = useMemo(() => {
    if (!currentTournament || !matchId) return null;
    return currentTournament.matches.find(m => m.id === matchId);
  }, [currentTournament, matchId]);

  const teamIdToShow = teamContext === 'home' ? currentMatch?.homeTeamId : currentMatch?.awayTeamId;
  const teamToShow = currentTournament?.teams.find(t => t.id === teamIdToShow);

  const standings = useMemo(() => {
    if (!currentTournament || !selectedMatchCategory) return [];

    const finishedMatches = currentTournament.matches.filter(m => m.summary && m.categoryId === selectedMatchCategory);
    const teamsInCategory = currentTournament.teams.filter(t => t.category === selectedMatchCategory);
      
    const stats = teamsInCategory.map(team => {
        const teamStats: TeamStats = {
          id: team.id, name: team.name, pj: 0, pg: 0, pe: 0, pp: 0, pg_ot: 0, pp_ot: 0, gf: 0, gc: 0, puntos: 0
        };

        finishedMatches
          .filter(m => m.homeTeamId === team.id || m.awayTeamId === team.id)
          .forEach(match => {
            teamStats.pj++;
            const homeScore = match.summary?.home.goals.length || 0;
            const awayScore = match.summary?.away.goals.length || 0;
            const wentToOTOrSO = (match.summary?.statsByPeriod && Object.keys(match.summary.statsByPeriod).some(p => p.startsWith('OT'))) || 
                                 (match.summary?.shootout && (match.summary.shootout.homeAttempts.length > 0 || match.summary.shootout.awayAttempts.length > 0));

            const isHome = match.homeTeamId === team.id;
            
            teamStats.gf += isHome ? homeScore : awayScore;
            teamStats.gc += isHome ? awayScore : homeScore;

            if (homeScore > awayScore) {
              if (isHome) {
                if (wentToOTOrSO) teamStats.pg_ot++; else teamStats.pg++;
              } else {
                if (wentToOTOrSO) teamStats.pp_ot++; else teamStats.pp++;
              }
            } else if (awayScore > homeScore) {
              if (!isHome) {
                if (wentToOTOrSO) teamStats.pg_ot++; else teamStats.pg++;
              } else {
                if (wentToOTOrSO) teamStats.pp_ot++; else teamStats.pp++;
              }
            } else {
              teamStats.pe++;
            }
          });
        
        teamStats.puntos = (teamStats.pg * 3) + (teamStats.pe * 1) + (teamStats.pg_ot * 2) + (teamStats.pp_ot * 1);
        return teamStats;
      });

      return stats.sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        const diffA = a.gf - a.gc;
        const diffB = b.gf - b.gc;
        if(diffB !== diffA) return diffB - diffA;
        if (a.pj !== b.pj) return a.pj - b.pj;
        return b.gf - a.gf;
      });

  }, [currentTournament, selectedMatchCategory]);
  
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
                <TableHead className="w-1/2">Equipo</TableHead>
                <TableHead className="text-center">PJ</TableHead>
                <TableHead className="text-center">PG</TableHead>
                <TableHead className="text-center">PE</TableHead>
                <TableHead className="text-center">PP</TableHead>
                <TableHead className="text-center">Pts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map(teamStat => (
                <TableRow key={teamStat.id} className={cn(teamStat.id === teamIdToShow && "bg-primary/20 text-foreground font-bold")}>
                  <TableCell className="font-medium">{teamStat.name}</TableCell>
                  <TableCell className="text-center">{teamStat.pj}</TableCell>
                  <TableCell className="text-center">{teamStat.pg + teamStat.pg_ot}</TableCell>
                  <TableCell className="text-center">{teamStat.pe}</TableCell>
                  <TableCell className="text-center">{teamStat.pp + teamStat.pp_ot}</TableCell>
                  <TableCell className="text-center font-bold text-lg">{teamStat.puntos}</TableCell>
                </TableRow>
              ))}
              {standings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">No hay datos de posiciones.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
