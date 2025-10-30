
"use client";

import React, { useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Info } from 'lucide-react';
import type { TeamData, Team } from '@/types';
import { cn } from '@/lib/utils';

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

export function StandingsTab() {
  const { state } = useGameState();
  const { tournaments, selectedTournamentId } = state.config;

  const selectedTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const standingsByCat = useMemo(() => {
    if (!selectedTournament) return [];

    const finishedMatches = selectedTournament.matches.filter(m => m.summary);

    return selectedTournament.categories.map(category => {
      const teamsInCategory = selectedTournament.teams.filter(t => t.category === category.id);
      
      const stats: TeamStats[] = teamsInCategory.map(team => {
        const teamStats: TeamStats = {
          id: team.id,
          name: team.name,
          pj: 0, pg: 0, pe: 0, pp: 0, pg_ot: 0, pp_ot: 0, gf: 0, gc: 0, puntos: 0
        };

        finishedMatches
          .filter(m => m.categoryId === category.id && (m.homeTeamId === team.id || m.awayTeamId === team.id))
          .forEach(match => {
            teamStats.pj++;
            const homeScore = match.summary?.home.goals.length || 0;
            const awayScore = match.summary?.away.goals.length || 0;
            const wentToOTOrSO = (match.summary?.statsByPeriod && Object.keys(match.summary.statsByPeriod).some(p => p.startsWith('OT'))) || 
                                 (match.summary?.shootout && (match.summary.shootout.homeAttempts.length > 0 || match.summary.shootout.awayAttempts.length > 0));

            const isHome = match.homeTeamId === team.id;
            
            teamStats.gf += isHome ? homeScore : awayScore;
            teamStats.gc += isHome ? awayScore : homeScore;

            if (homeScore > awayScore) { // Team won
              if (isHome) {
                if (wentToOTOrSO) teamStats.pg_ot++; else teamStats.pg++;
              } else { // Team is away, and lost
                if (wentToOTOrSO) teamStats.pp_ot++; else teamStats.pp++;
              }
            } else if (awayScore > homeScore) { // Team lost
              if (!isHome) { // Team is away, and won
                if (wentToOTOrSO) teamStats.pg_ot++; else teamStats.pg++;
              } else { // Team is home, and lost
                if (wentToOTOrSO) teamStats.pp_ot++; else teamStats.pp++;
              }
            } else { // Tie
              teamStats.pe++;
            }
          });
        
        teamStats.puntos = (teamStats.pg * 3) + (teamStats.pe * 1) + (teamStats.pg_ot * 2) + (teamStats.pp_ot * 1);
        return teamStats;
      });

      // Sort stats
      stats.sort((a, b) => {
        if (b.puntos !== a.puntos) return b.puntos - a.puntos;
        const diffA = a.gf - a.gc;
        const diffB = b.gf - b.gc;
        if(diffB !== diffA) return diffB - diffA;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.pj - b.pj;
      });

      const rankedStats: (TeamStats & { rank: number })[] = [];
      stats.forEach((team, index) => {
          let rank = index + 1;
          if (index > 0) {
            const prevTeam = stats[index - 1];
            const diffA = team.gf - team.gc;
            const diffB = prevTeam.gf - prevTeam.gc;
            // Check if the current team should have the same rank as the previous one
            if (team.puntos === prevTeam.puntos && team.pj === prevTeam.pj && diffA === diffB && team.gf === prevTeam.gf) {
              rank = rankedStats[index - 1].rank;
            }
          }
          rankedStats.push({ ...team, rank });
        });

      return {
        categoryName: category.name,
        stats: rankedStats
      };
    }).filter(cat => cat.stats.length > 0);
  }, [selectedTournament]);

  if (!selectedTournament) return null;
  
  return (
    <div className="space-y-8">
        <div className="flex items-start gap-2 p-3 text-sm border rounded-lg bg-muted/50 text-muted-foreground">
            <Info className="h-5 w-5 mt-0.5 shrink-0"/>
            <p>El sistema de puntos es: 3 por victoria, 2 por victoria en OT/Penales, 1 por derrota en OT/Penales, y 1 por empate.</p>
        </div>

        {standingsByCat.map(({ categoryName, stats }) => (
            <Card key={categoryName}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-2xl">
                        <Trophy className="h-6 w-6 text-amber-400" />
                        {categoryName}
                    </CardTitle>
                </CardHeader>
                <CardContent>
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
                            {stats.map(team => (
                                <TableRow key={team.id}>
                                    <TableCell className="text-center font-bold">{team.rank}</TableCell>
                                    <TableCell className="font-medium">{team.name}</TableCell>
                                    <TableCell className="text-center">{team.pj}</TableCell>
                                    <TableCell className="text-center">{team.pg + team.pg_ot}</TableCell>
                                    <TableCell className="text-center">{team.pe}</TableCell>
                                    <TableCell className="text-center">{team.pp + team.pp_ot}</TableCell>
                                    <TableCell className="text-center">{team.gf}</TableCell>
                                    <TableCell className="text-center">{team.gc}</TableCell>
                                    <TableCell className="text-center font-bold text-lg">{team.puntos}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        ))}

        {standingsByCat.length === 0 && (
            <div className="text-center py-12">
                <p className="text-muted-foreground">No hay datos de posiciones para mostrar. Juega y finaliza partidos para empezar.</p>
            </div>
        )}
    </div>
  );
}
