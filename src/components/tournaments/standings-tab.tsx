
"use client";

import React, { useMemo } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Info } from 'lucide-react';

interface TeamStats {
  id: string;
  name: string;
  pj: number; // Partidos Jugados
  pg: number; // Partidos Ganados en tiempo regular
  pe: number; // Partidos Empatados
  pp: number; // Partidos Perdidos en tiempo regular
  pg_ot: number; // Partidos Ganados en OT
  pp_ot: number; // Partidos Perdidos en OT
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
      
      const stats = teamsInCategory.map(team => {
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
            const wentToOT = match.summary?.statsByPeriod && Object.keys(match.summary.statsByPeriod).some(p => p.startsWith('OT'));
            
            if (match.homeTeamId === team.id) {
              teamStats.gf += homeScore;
              teamStats.gc += awayScore;
              if (homeScore > awayScore) {
                if (wentToOT) teamStats.pg_ot++; else teamStats.pg++;
              } else if (homeScore < awayScore) {
                if (wentToOT) teamStats.pp_ot++; else teamStats.pp++;
              } else {
                teamStats.pe++;
              }
            } else { // Away team
              teamStats.gf += awayScore;
              teamStats.gc += homeScore;
              if (awayScore > homeScore) {
                if (wentToOT) teamStats.pg_ot++; else teamStats.pg++;
              } else if (awayScore < homeScore) {
                if (wentToOT) teamStats.pp_ot++; else teamStats.pp++;
              } else {
                teamStats.pe++;
              }
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
        if (a.pj !== b.pj) return a.pj - b.pj;
        return b.gf - a.gf;
      });

      return {
        categoryName: category.name,
        stats: stats
      };
    }).filter(cat => cat.stats.length > 0);
  }, [selectedTournament]);

  if (!selectedTournament) return null;
  
  return (
    <div className="space-y-8">
        <div className="flex items-start gap-2 p-3 text-sm border rounded-lg bg-muted/50 text-muted-foreground">
            <Info className="h-5 w-5 mt-0.5 shrink-0"/>
            <p>Observación: La tabla de posiciones otorga 3 puntos por victoria en tiempo regular, 2 puntos por victoria en tiempo extra/penales, 1 punto por derrota en tiempo extra/penales y 1 punto por empate.</p>
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
