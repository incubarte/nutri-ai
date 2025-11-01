
"use client";

import { useMemo } from 'react';
import type { Tournament, TeamData, CategoryData } from '@/types';

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

export function useStandings(tournament: Tournament | null | undefined, categoryId: string) {
  const standings = useMemo(() => {
    if (!tournament || !categoryId) return [];

    const finishedMatches = (tournament.matches || []).filter(m => m.summary && m.categoryId === categoryId);
    const teamsInCategory = (tournament.teams || []).filter(t => t.category === categoryId);
      
    const stats: TeamStats[] = teamsInCategory.map(team => {
        const teamStats: TeamStats = {
          id: team.id,
          name: team.name,
          pj: 0, pg: 0, pe: 0, pp: 0, pg_ot: 0, pp_ot: 0, gf: 0, gc: 0, puntos: 0
        };

        finishedMatches
          .filter(m => m.homeTeamId === team.id || m.awayTeamId === team.id)
          .forEach(match => {
            if (!match.summary) return; // Should not happen due to filter, but for type safety

            teamStats.pj++;
            
            const homeGoals = (match.summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.home?.length ?? 0), 0) + (match.summary.shootout?.homeAttempts.filter(a => a.isGoal).length ?? 0);
            const awayGoals = (match.summary.statsByPeriod || []).reduce((acc, p) => acc + (p.stats.goals.away?.length ?? 0), 0) + (match.summary.shootout?.awayAttempts.filter(a => a.isGoal).length ?? 0);
            
            const wentToOTOrSO = match.overTimeOrShootouts || false;
            const isHome = match.homeTeamId === team.id;
            
            teamStats.gf += isHome ? homeGoals : awayGoals;
            teamStats.gc += isHome ? awayGoals : homeGoals;

            if (homeGoals > awayGoals) { // Home team won
              if (isHome) {
                if (wentToOTOrSO) teamStats.pg_ot++; else teamStats.pg++;
              } else { // Away team lost
                if (wentToOTOrSO) teamStats.pp_ot++; else teamStats.pp++;
              }
            } else if (awayGoals > homeGoals) { // Away team won
              if (!isHome) { 
                if (wentToOTOrSO) teamStats.pg_ot++; else teamStats.pg++;
              } else { // Home team lost
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
            if (team.puntos === prevTeam.puntos && team.pj === prevTeam.pj && diffA === diffB && team.gf === prevTeam.gf) {
              rank = rankedStats[index - 1].rank;
            }
          }
          rankedStats.push({ ...team, rank });
        });

      return rankedStats;

  }, [tournament, categoryId]);

  return standings;
}
