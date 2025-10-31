
"use client";

import type { GameState, GameSummary, PeriodStats, SummaryPlayerStats, GoalLog, ShotLog, AttendedPlayerInfo, Team, PlayerData, PenaltyLog, PeriodSummary } from "@/types";

export const recalculateAllStatsFromLogs = (partialSummary: Partial<{ goals: { home: GoalLog[], away: GoalLog[] }, home: { homeShotsLog?: ShotLog[] }, away: { awayShotsLog?: ShotLog[] } }>, homeTeamRoster: PlayerData[], awayTeamRoster: PlayerData[]): { home: SummaryPlayerStats[], away: SummaryPlayerStats[] } => {
    const homePlayerStatsMap = new Map<string, SummaryPlayerStats>();
    const awayPlayerStatsMap = new Map<string, SummaryPlayerStats>();

    // Initialize with all players from roster to ensure everyone is listed
    homeTeamRoster.forEach(p => homePlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));
    awayTeamRoster.forEach(p => awayPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

    // Process goals and assists
    (partialSummary.goals?.home || []).forEach(goal => {
        const scorerId = homeTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
        if (scorerId && homePlayerStatsMap.has(scorerId)) homePlayerStatsMap.get(scorerId)!.goals++;
        const assistId = homeTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
        if (assistId && homePlayerStatsMap.has(assistId)) homePlayerStatsMap.get(assistId)!.assists++;
    });
    (partialSummary.goals?.away || []).forEach(goal => {
        const scorerId = awayTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
        if (scorerId && awayPlayerStatsMap.has(scorerId)) awayPlayerStatsMap.get(scorerId)!.goals++;
        const assistId = awayTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
        if (assistId && awayPlayerStatsMap.has(assistId)) awayPlayerStatsMap.get(assistId)!.assists++;
    });

    // Process shots
    (partialSummary.home?.homeShotsLog || []).forEach(shot => {
        if (shot.playerId && homePlayerStatsMap.has(shot.playerId)) homePlayerStatsMap.get(shot.playerId)!.shots++;
    });
    (partialSummary.away?.awayShotsLog || []).forEach(shot => {
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
    
    const allPlayedPeriods = [...(live.playedPeriods || [])];
    
    const statsByPeriodArray: PeriodSummary[] = allPlayedPeriods.map(periodText => {
        const periodData: PeriodStats = {
            goals: { home: [], away: [] },
            penalties: { home: [], away: [] },
            playerStats: { home: [], away: [] }
        };

        // Filter events for the current period.
        periodData.goals.home = (live.goals.home || []).filter(g => g.periodText === periodText);
        periodData.goals.away = (live.goals.away || []).filter(g => g.periodText === periodText);
        periodData.penalties.home = (live.penaltiesLog.home || []).filter(p => p.addPeriodText === periodText);
        periodData.penalties.away = (live.penaltiesLog.away || []).filter(p => p.addPeriodText === periodText);
        
        // Recalculate player stats specifically for this period.
        const periodSummaryForStats = {
          goals: periodData.goals,
          home: { homeShotsLog: (live.shotsLog.home || []).filter(s => s.periodText === periodText) },
          away: { awayShotsLog: (live.shotsLog.away || []).filter(s => s.periodText === periodText) },
        };
        const periodPlayerStats = recalculateAllStatsFromLogs(periodSummaryForStats, homeTeamRoster, awayTeamRoster);
        periodData.playerStats.home = periodPlayerStats.home;
        periodData.playerStats.away = periodPlayerStats.away;
        
        return { period: periodText, stats: periodData };
    });

    // Create the base summary object.
    const finalSummary: GameSummary = {
        attendance: live.attendance,
        statsByPeriod: statsByPeriodArray,
        playedPeriods: live.playedPeriods || [],
    };

    const overTimeOrShootouts = (live.shootout && (live.shootout.homeAttempts.length > 0 || live.shootout.awayAttempts.length > 0)) || allPlayedPeriods.some(p => p.startsWith('OT'));
    finalSummary.overTimeOrShootouts = overTimeOrShootouts;

    if (live.shootout && (live.shootout.homeAttempts.length > 0 || live.shootout.awayAttempts.length > 0)) {
        const { isActive, ...shootoutSummary } = live.shootout;
        finalSummary.shootout = shootoutSummary;
    }

    return finalSummary;
};
