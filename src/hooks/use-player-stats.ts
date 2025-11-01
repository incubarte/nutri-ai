
"use client";

import { useMemo } from 'react';
import type { Tournament, PlayerData } from '@/types';

interface PlayerStats {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  goals: number;
  assists: number;
  points: number;
  penaltyCount: number;
  penaltyMinutes: number;
}

export function usePlayerStats(tournament: Tournament | null | undefined, categoryId: string | null) {
  const playerStats = useMemo(() => {
    if (!tournament) return [];

    let finishedMatches = tournament.matches || [];
    if (categoryId) {
        finishedMatches = finishedMatches.filter(m => m.categoryId === categoryId);
    }
    finishedMatches = finishedMatches.filter(m => m.summary);

    const statsMap = new Map<string, PlayerStats>();
    const allTeams = tournament.teams || [];

    // Initialize all players
    allTeams.forEach(team => {
        if (!categoryId || team.category === categoryId) {
            team.players.forEach(player => {
                if (!statsMap.has(player.id)) {
                    statsMap.set(player.id, {
                        playerId: player.id,
                        playerName: player.name,
                        teamId: team.id,
                        teamName: team.name,
                        goals: 0,
                        assists: 0,
                        points: 0,
                        penaltyCount: 0,
                        penaltyMinutes: 0
                    });
                }
            });
        }
    });

    finishedMatches.forEach(match => {
        if (!match.summary || !match.summary.statsByPeriod) return;

        match.summary.statsByPeriod.forEach(period => {
            // Process goals and assists
            ['home', 'away'].forEach(teamStr => {
                const teamId = teamStr === 'home' ? match.homeTeamId : match.awayTeamId;
                const team = allTeams.find(t => t.id === teamId);
                if (!team) return;

                (period.stats.goals[teamStr as 'home' | 'away'] || []).forEach(goal => {
                    const scorer = team.players.find(p => p.number === goal.scorer?.playerNumber);
                    if (scorer && statsMap.has(scorer.id)) {
                        statsMap.get(scorer.id)!.goals++;
                    }
                    const assist = team.players.find(p => p.number === goal.assist?.playerNumber);
                    if (assist && statsMap.has(assist.id)) {
                        statsMap.get(assist.id)!.assists++;
                    }
                });

                // Process penalties
                 (period.stats.penalties[teamStr as 'home' | 'away'] || []).forEach(penalty => {
                    const player = team.players.find(p => p.number === penalty.playerNumber);
                     if (player && statsMap.has(player.id)) {
                        const stat = statsMap.get(player.id)!;
                        stat.penaltyCount++;
                        stat.penaltyMinutes += (penalty.initialDuration || 0) / 60;
                    }
                });
            });
        });
    });

    // Calculate points and create array
    const statsArray = Array.from(statsMap.values()).map(stat => ({
      ...stat,
      points: (stat.goals * 2) + stat.assists,
    }));

    // Filter out players with no activity
    const activePlayers = statsArray.filter(
        stat => stat.goals > 0 || stat.assists > 0 || stat.penaltyCount > 0
    );

    // Sort by points, then goals, then assists
    activePlayers.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goals !== a.goals) return b.goals - a.goals;
        if (b.assists !== a.assists) return b.assists - a.assists;
        if (a.penaltyMinutes !== b.penaltyMinutes) return a.penaltyMinutes - b.penaltyMinutes;
        return a.playerName.localeCompare(b.playerName);
    });

    // Add rank
    return activePlayers.map((stat, index) => ({
      ...stat,
      rank: index + 1
    }));

  }, [tournament, categoryId]);

  return playerStats;
}
