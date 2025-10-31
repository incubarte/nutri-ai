
"use client";

import type { GameState, GameSummary, PeriodStats, SummaryPlayerStats, GoalLog, ShotLog, AttendedPlayerInfo, Team, PlayerData } from "@/types";
import { getPeriodText } from "@/contexts/game-state-context";

export const recalculateAllStatsFromLogs = (gameSummary: GameSummary): { homePlayerStats: SummaryPlayerStats[], awayPlayerStats: SummaryPlayerStats[], homeTotalShots: number, awayTotalShots: number } => {
    const homePlayerStatsMap = new Map<string, SummaryPlayerStats>();
    const awayPlayerStatsMap = new Map<string, SummaryPlayerStats>();

    // Initialize with all attended players to ensure they are on the list
    gameSummary.attendance.home.forEach(p => {
        homePlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 });
    });
    gameSummary.attendance.away.forEach(p => {
        awayPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 });
    });

    // Process goals and assists
    [...gameSummary.home.goals, ...gameSummary.away.goals].forEach(goal => {
        const statsMap = goal.team === 'home' ? homePlayerStatsMap : awayPlayerStatsMap;
        const scorerId = gameSummary.attendance[goal.team].find(p => p.number === goal.scorer?.playerNumber)?.id;
        if (scorerId && statsMap.has(scorerId)) {
            statsMap.get(scorerId)!.goals++;
        }
        const assistId = gameSummary.attendance[goal.team].find(p => p.number === goal.assist?.playerNumber)?.id;
        if (assistId && statsMap.has(assistId)) {
            statsMap.get(assistId)!.assists++;
        }
    });
    
    // Process shots
    const homeShotsLog = gameSummary.home.homeShotsLog || [];
    const awayShotsLog = gameSummary.away.awayShotsLog || [];

    [...homeShotsLog, ...awayShotsLog].forEach(shot => {
        const statsMap = shot.team === 'home' ? homePlayerStatsMap : awayPlayerStatsMap;
        if (shot.playerId && statsMap.has(shot.playerId)) {
            statsMap.get(shot.playerId)!.shots++;
        }
    });

    const homeTotalShots = homeShotsLog.length;
    const awayTotalShots = awayShotsLog.length;
    
    return { 
        homePlayerStats: Array.from(homePlayerStatsMap.values()),
        awayPlayerStats: Array.from(awayPlayerStatsMap.values()),
        homeTotalShots,
        awayTotalShots 
    };
};

export const generateSummaryData = (state: GameState): GameSummary | null => {
    const { live, config } = state;
    if (!live || !config) return null;

    const summary: GameSummary = JSON.parse(JSON.stringify(live.gameSummary));
    
    // 1. Recalculate total aggregated stats for all players first
    const { homePlayerStats, awayPlayerStats } = recalculateAllStatsFromLogs(summary);
    summary.home.playerStats = homePlayerStats;
    summary.away.playerStats = awayPlayerStats;

    // 2. Generate stats per period
    const statsByPeriod: Record<string, PeriodStats> = {};
    const { playedPeriods } = live;

    const currentTournament = config.tournaments.find(t => t.id === config.selectedTournamentId);
    const homeTeamRoster = currentTournament?.teams.find(t => t.name === live.homeTeamName && (t.subName || undefined) === (live.homeTeamSubName || undefined) && t.category === config.selectedMatchCategory)?.players || [];
    const awayTeamRoster = currentTournament?.teams.find(t => t.name === live.awayTeamName && (t.subName || undefined) === (live.awayTeamSubName || undefined) && t.category === config.selectedMatchCategory)?.players || [];


    (playedPeriods || []).forEach(periodText => {
        const homePeriodStats = new Map<string, SummaryPlayerStats>();
        homeTeamRoster.forEach(p => homePeriodStats.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

        const awayPeriodStats = new Map<string, SummaryPlayerStats>();
        awayTeamRoster.forEach(p => awayPeriodStats.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

        const homeGoalsInPeriod = summary.home.goals.filter(g => g.periodText === periodText);
        homeGoalsInPeriod.forEach(goal => {
            const scorerId = homeTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
            if (scorerId && homePeriodStats.has(scorerId)) homePeriodStats.get(scorerId)!.goals++;
            const assistId = homeTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
            if (assistId && homePeriodStats.has(assistId)) homePeriodStats.get(assistId)!.assists++;
        });
        (summary.home.homeShotsLog || []).filter(s => s.periodText === periodText).forEach(shot => {
             if (shot.playerId && homePeriodStats.has(shot.playerId)) homePeriodStats.get(shot.playerId)!.shots++;
        });

        const awayGoalsInPeriod = summary.away.goals.filter(g => g.periodText === periodText);
        awayGoalsInPeriod.forEach(goal => {
            const scorerId = awayTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
            if (scorerId && awayPeriodStats.has(scorerId)) awayPeriodStats.get(scorerId)!.goals++;
            const assistId = awayTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
            if (assistId && awayPeriodStats.has(assistId)) awayPeriodStats.get(assistId)!.assists++;
        });
        (summary.away.awayShotsLog || []).filter(s => s.periodText === periodText).forEach(shot => {
             if (shot.playerId && awayPeriodStats.has(shot.playerId)) awayPeriodStats.get(shot.playerId)!.shots++;
        });

        statsByPeriod[periodText] = {
            home: {
                goals: homeGoalsInPeriod,
                playerStats: Array.from(homePeriodStats.values()),
            },
            away: {
                goals: awayGoalsInPeriod,
                playerStats: Array.from(awayPeriodStats.values()),
            },
        };
    });

    summary.statsByPeriod = statsByPeriod;
    
    const overTimeOrShootouts = (live.shootout && (live.shootout.homeAttempts.length > 0 || live.shootout.awayAttempts.length > 0)) || Object.keys(summary.statsByPeriod || {}).some(p => p.startsWith('OT'));
    summary.overTimeOrShootouts = overTimeOrShootouts;

    if (live.shootout && (live.shootout.homeAttempts.length > 0 || live.shootout.awayAttempts.length > 0)) {
        const { isActive, rounds, ...shootoutSummary } = live.shootout;
        summary.shootout = shootoutSummary;
    }

    return summary;
};
