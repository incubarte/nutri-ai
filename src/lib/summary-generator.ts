
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
    (gameSummary.home?.homeShotsLog || []).forEach(shot => {
        if (shot.playerId && homePlayerStatsMap.has(shot.playerId)) homePlayerStatsMap.get(shot.playerId)!.shots++;
    });
    (gameSummary.away?.awayShotsLog || []).forEach(shot => {
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
    
    // Create the base summary object with the new simplified structure.
    const finalSummary: GameSummary = {
        attendance: live.gameSummary.attendance,
        goals: { home: live.gameSummary.home.goals || [], away: live.gameSummary.away.goals || [] },
        penalties: { home: live.gameSummary.home.penalties || [], away: live.gameSummary.away.penalties || [] },
        playerStats: { home: [], away: [] },
        home: {
            ...live.gameSummary.home,
            homeShotsLog: live.gameSummary.home?.homeShotsLog || [],
        },
        away: {
            ...live.gameSummary.away,
            awayShotsLog: live.gameSummary.away?.awayShotsLog || [],
        },
        statsByPeriod: {},
        playedPeriods: live.playedPeriods || [],
    };

    // Recalculate aggregated player stats for the whole game.
    const aggregatedStats = recalculateAllStatsFromLogs(finalSummary, homeTeamRoster, awayTeamRoster);
    finalSummary.playerStats.home = aggregatedStats.home;
    finalSummary.playerStats.away = aggregatedStats.away;

    // Use live.playedPeriods as the source of truth for all periods.
    (live.playedPeriods || []).forEach(periodText => {
        // Initialize the structure for this period with home/away containers.
        const periodData: PeriodStats = {
            goals: { home: [], away: [] },
            penalties: { home: [], away: [] },
            playerStats: { home: [], away: [] }
        };

        // Filter events for the current period.
        periodData.goals.home = (finalSummary.goals.home || []).filter(g => g.periodText === periodText);
        periodData.goals.away = (finalSummary.goals.away || []).filter(g => g.periodText === periodText);
        periodData.penalties.home = (finalSummary.penalties.home || []).filter(p => p.addPeriodText === periodText);
        periodData.penalties.away = (finalSummary.penalties.away || []).filter(p => p.addPeriodText === periodText);
        
        // Recalculate player stats specifically for this period.
        const periodSummaryForStats: GameSummary = {
          ...finalSummary,
          goals: periodData.goals,
          home: { ...finalSummary.home, homeShotsLog: (finalSummary.home?.homeShotsLog || []).filter(s => s.periodText === periodText) },
          away: { ...finalSummary.away, awayShotsLog: (finalSummary.away?.awayShotsLog || []).filter(s => s.periodText === periodText) },
        };
        const periodPlayerStats = recalculateAllStatsFromLogs(periodSummaryForStats, homeTeamRoster, awayTeamRoster);
        periodData.playerStats.home = periodPlayerStats.home;
        periodData.playerStats.away = periodPlayerStats.away;

        // Assign the fully calculated data for the period.
        finalSummary.statsByPeriod![periodText] = periodData;
    });

    const overTimeOrShootouts = (live.shootout && (live.shootout.homeAttempts.length > 0 || live.shootout.awayAttempts.length > 0)) || Object.keys(finalSummary.statsByPeriod || {}).some(p => p.startsWith('OT'));
    finalSummary.overTimeOrShootouts = overTimeOrShootouts;

    if (live.shootout && (live.shootout.homeAttempts.length > 0 || live.shootout.awayAttempts.length > 0)) {
        const { isActive, ...shootoutSummary } = live.shootout;
        finalSummary.shootout = shootoutSummary;
    }

    return finalSummary;
};
