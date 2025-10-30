
"use client";

import type { GameState, GameSummary, PeriodStats, SummaryPlayerStats, GoalLog, ShotLog, AttendedPlayerInfo, Team } from "@/types";
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
    
    const { homePlayerStats, awayPlayerStats } = recalculateAllStatsFromLogs(summary);
    summary.home.playerStats = homePlayerStats;
    summary.away.playerStats = awayPlayerStats;

    const statsByPeriod: Record<string, PeriodStats> = {};
    const { playedPeriods } = live;

    (playedPeriods || []).forEach(periodText => {
        if (!statsByPeriod[periodText]) {
            statsByPeriod[periodText] = {
                home: { goals: [], playerStats: [] },
                away: { goals: [], playerStats: [] }
            };
        }
        
        // --- Home Team Stats for the Period ---
        const homeAttendance = summary.attendance.home || [];
        const homePlayerStatsMap = new Map<string, SummaryPlayerStats>();
        homeAttendance.forEach(p => homePlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

        const homeGoalsInPeriod = summary.home.goals.filter(g => g.periodText === periodText);
        homeGoalsInPeriod.forEach(goal => {
            statsByPeriod[periodText].home.goals.push(goal);
            const scorerId = homeAttendance.find(p => p.number === goal.scorer?.playerNumber)?.id;
            if (scorerId && homePlayerStatsMap.has(scorerId)) homePlayerStatsMap.get(scorerId)!.goals++;
            const assistId = homeAttendance.find(p => p.number === goal.assist?.playerNumber)?.id;
            if (assistId && homePlayerStatsMap.has(assistId)) homePlayerStatsMap.get(assistId)!.assists++;
        });
        (summary.home.homeShotsLog || []).filter(s => s.periodText === periodText).forEach(shot => {
             if (shot.playerId && homePlayerStatsMap.has(shot.playerId)) homePlayerStatsMap.get(shot.playerId)!.shots++;
        });
        statsByPeriod[periodText].home.playerStats = Array.from(homePlayerStatsMap.values());


        // --- Away Team Stats for the Period ---
        const awayAttendance = summary.attendance.away || [];
        const awayPlayerStatsMap = new Map<string, SummaryPlayerStats>();
        awayAttendance.forEach(p => awayPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

        const awayGoalsInPeriod = summary.away.goals.filter(g => g.periodText === periodText);
        awayGoalsInPeriod.forEach(goal => {
            statsByPeriod[periodText].away.goals.push(goal);
            const scorerId = awayAttendance.find(p => p.number === goal.scorer?.playerNumber)?.id;
            if (scorerId && awayPlayerStatsMap.has(scorerId)) awayPlayerStatsMap.get(scorerId)!.goals++;
            const assistId = awayAttendance.find(p => p.number === goal.assist?.playerNumber)?.id;
            if (assistId && awayPlayerStatsMap.has(assistId)) awayPlayerStatsMap.get(assistId)!.assists++;
        });
        (summary.away.awayShotsLog || []).filter(s => s.periodText === periodText).forEach(shot => {
             if (shot.playerId && awayPlayerStatsMap.has(shot.playerId)) awayPlayerStatsMap.get(shot.playerId)!.shots++;
        });
        statsByPeriod[periodText].away.playerStats = Array.from(awayPlayerStatsMap.values());
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
