
"use client";

import type { GameState, GameSummary, PeriodStats, SummaryPlayerStats, GoalLog, ShotLog, AttendedPlayerInfo, Team, PlayerData, PenaltyLog } from "@/types";

export const recalculateAllStatsFromLogs = (gameSummary: GameSummary, homeTeamRoster: PlayerData[], awayTeamRoster: PlayerData[]): { home: SummaryPlayerStats[], away: SummaryPlayerStats[] } => {
    const homePlayerStatsMap = new Map<string, SummaryPlayerStats>();
    const awayPlayerStatsMap = new Map<string, SummaryPlayerStats>();

    // Initialize with all players from roster to ensure everyone is listed
    homeTeamRoster.forEach(p => homePlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));
    awayTeamRoster.forEach(p => awayPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

    // Process goals and assists
    (gameSummary.goals.home || []).forEach(goal => {
        const scorerId = homeTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
        if (scorerId && homePlayerStatsMap.has(scorerId)) homePlayerStatsMap.get(scorerId)!.goals++;
        const assistId = homeTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
        if (assistId && homePlayerStatsMap.has(assistId)) homePlayerStatsMap.get(assistId)!.assists++;
    });
    (gameSummary.goals.away || []).forEach(goal => {
        const scorerId = awayTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
        if (scorerId && awayPlayerStatsMap.has(scorerId)) awayPlayerStatsMap.get(scorerId)!.goals++;
        const assistId = awayTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
        if (assistId && awayPlayerStatsMap.has(assistId)) awayPlayerStatsMap.get(assistId)!.assists++;
    });

    // Process shots
    (gameSummary.homeShotsLog || []).forEach(shot => {
        if (shot.playerId && homePlayerStatsMap.has(shot.playerId)) homePlayerStatsMap.get(shot.playerId)!.shots++;
    });
    (gameSummary.awayShotsLog || []).forEach(shot => {
        if (shot.playerId && awayPlayerStatsMap.has(shot.playerId)) awayPlayerStatsMap.get(shot.playerId)!.shots++;
    });
    
    return { home: Array.from(homePlayerStatsMap.values()), away: Array.from(awayPlayerStatsMap.values()) };
};


export const generateSummaryData = (state: GameState): GameSummary | null => {
    const { live, config } = state;
    if (!live || !config) return null;

    const currentTournament = config.tournaments.find(t => t.id === config.selectedTournamentId);
    const homeTeamRoster = currentTournament?.teams.find(t => t.name === live.homeTeamName && (t.subName || undefined) === (live.homeTeamSubName || undefined) && t.category === config.selectedMatchCategory)?.players || [];
    const awayTeamRoster = currentTournament?.teams.find(t => t.name === live.awayTeamName && (t.subName || undefined) === (live.awayTeamSubName || undefined) && t.category === config.selectedMatchCategory)?.players || [];
    
    const baseSummary: GameSummary = {
        attendance: live.gameSummary.attendance,
        goals: { home: live.gameSummary.goals.home || [], away: live.gameSummary.goals.away || [] },
        penalties: { home: live.gameSummary.penalties.home || [], away: live.gameSummary.penalties.away || [] },
        playerStats: { home: [], away: [] },
        homeShotsLog: live.gameSummary.home.homeShotsLog || [],
        awayShotsLog: live.gameSummary.away.awayShotsLog || [],
        playedPeriods: live.playedPeriods || [],
    };
    
    const aggregatedStats = recalculateAllStatsFromLogs(baseSummary, homeTeamRoster, awayTeamRoster);
    baseSummary.playerStats.home = aggregatedStats.home;
    baseSummary.playerStats.away = aggregatedStats.away;
    
    const statsByPeriod: Record<string, PeriodStats> = {};
    
    (live.playedPeriods || []).forEach(periodText => {
        statsByPeriod[periodText] = {
            goals: { home: [], away: [] },
            penalties: { home: [], away: [] },
            playerStats: { home: [], away: [] }
        };

        const homePeriodPlayerStatsMap = new Map<string, SummaryPlayerStats>();
        homeTeamRoster.forEach(p => homePeriodPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));
        
        const awayPeriodPlayerStatsMap = new Map<string, SummaryPlayerStats>();
        awayTeamRoster.forEach(p => awayPeriodPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

        const homeGoalsInPeriod = (baseSummary.goals.home || []).filter(g => g.periodText === periodText);
        statsByPeriod[periodText].goals.home = homeGoalsInPeriod;

        const awayGoalsInPeriod = (baseSummary.goals.away || []).filter(g => g.periodText === periodText);
        statsByPeriod[periodText].goals.away = awayGoalsInPeriod;

        statsByPeriod[periodText].penalties.home = (baseSummary.penalties.home || []).filter(p => p.addPeriodText === periodText);
        statsByPeriod[periodText].penalties.away = (baseSummary.penalties.away || []).filter(p => p.addPeriodText === periodText);

        homeGoalsInPeriod.forEach(goal => {
            const scorerId = homeTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
            if (scorerId && homePeriodPlayerStatsMap.has(scorerId)) homePeriodPlayerStatsMap.get(scorerId)!.goals++;
            const assistId = homeTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
            if (assistId && homePeriodPlayerStatsMap.has(assistId)) homePeriodPlayerStatsMap.get(assistId)!.assists++;
        });
        (baseSummary.homeShotsLog || []).filter(s => s.periodText === periodText).forEach(shot => {
             if (shot.playerId && homePeriodPlayerStatsMap.has(shot.playerId)) homePeriodPlayerStatsMap.get(shot.playerId)!.shots++;
        });

        awayGoalsInPeriod.forEach(goal => {
            const scorerId = awayTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
            if (scorerId && awayPeriodPlayerStatsMap.has(scorerId)) awayPeriodPlayerStatsMap.get(scorerId)!.goals++;
            const assistId = awayTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
            if (assistId && awayPeriodPlayerStatsMap.has(assistId)) awayPeriodPlayerStatsMap.get(assistId)!.assists++;
        });
        (baseSummary.awayShotsLog || []).filter(s => s.periodText === periodText).forEach(shot => {
             if (shot.playerId && awayPeriodPlayerStatsMap.has(shot.playerId)) awayPeriodPlayerStatsMap.get(shot.playerId)!.shots++;
        });
        
        statsByPeriod[periodText].playerStats.home = Array.from(homePeriodPlayerStatsMap.values());
        statsByPeriod[periodText].playerStats.away = Array.from(awayPeriodPlayerStatsMap.values());
    });

    baseSummary.statsByPeriod = statsByPeriod;
    const overTimeOrShootouts = (live.shootout && (live.shootout.homeAttempts.length > 0 || live.shootout.awayAttempts.length > 0)) || Object.keys(baseSummary.statsByPeriod || {}).some(p => p.startsWith('OT'));
    baseSummary.overTimeOrShootouts = overTimeOrShootouts;

    if (live.shootout && (live.shootout.homeAttempts.length > 0 || live.shootout.awayAttempts.length > 0)) {
        const { isActive, ...shootoutSummary } = live.shootout;
        baseSummary.shootout = shootoutSummary;
    }

    return baseSummary;
};
