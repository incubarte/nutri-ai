
"use client";

import type { GameState, GameSummary, PeriodStats, SummaryPlayerStats, GoalLog, ShotLog, AttendedPlayerInfo, Team, PlayerData } from "@/types";

export const recalculateAllStatsFromLogs = (gameSummary: GameSummary, homeTeamRoster: PlayerData[], awayTeamRoster: PlayerData[]): { home: SummaryPlayerStats[], away: SummaryPlayerStats[] } => {
    const homePlayerStatsMap = new Map<string, SummaryPlayerStats>();
    const awayPlayerStatsMap = new Map<string, SummaryPlayerStats>();

    // Initialize with all players from roster to ensure everyone is listed
    homeTeamRoster.forEach(p => homePlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));
    awayTeamRoster.forEach(p => awayPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

    // Process goals and assists
    (gameSummary.home.goals || []).forEach(goal => {
        const scorerId = homeTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
        if (scorerId && homePlayerStatsMap.has(scorerId)) homePlayerStatsMap.get(scorerId)!.goals++;
        const assistId = homeTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
        if (assistId && homePlayerStatsMap.has(assistId)) homePlayerStatsMap.get(assistId)!.assists++;
    });
    (gameSummary.away.goals || []).forEach(goal => {
        const scorerId = awayTeamRoster.find(p => p.number === goal.scorer?.playerNumber)?.id;
        if (scorerId && awayPlayerStatsMap.has(scorerId)) awayPlayerStatsMap.get(scorerId)!.goals++;
        const assistId = awayTeamRoster.find(p => p.number === goal.assist?.playerNumber)?.id;
        if (assistId && awayPlayerStatsMap.has(assistId)) awayPlayerStatsMap.get(assistId)!.assists++;
    });

    // Process shots
    (gameSummary.home.homeShotsLog || []).forEach(shot => {
        if (shot.playerId && homePlayerStatsMap.has(shot.playerId)) homePlayerStatsMap.get(shot.playerId)!.shots++;
    });
    (gameSummary.away.awayShotsLog || []).forEach(shot => {
        if (shot.playerId && awayPlayerStatsMap.has(shot.playerId)) awayPlayerStatsMap.get(shot.playerId)!.shots++;
    });
    
    return { home: Array.from(homePlayerStatsMap.values()), away: Array.from(awayPlayerStatsMap.values()) };
};


export const generateSummaryData = (state: GameState): GameSummary | null => {
    const { live, config } = state;
    if (!live || !config) return null;

    const currentTournament = config.tournaments.find(t => t.id === config.selectedTournamentId);
    const homeTeamRoster = currentTournament?.teams.find(t => t.name === live.homeTeamName && (t.subName || undefined) === (live.homeTeamSubName || undefined))?.players || [];
    const awayTeamRoster = currentTournament?.teams.find(t => t.name === live.awayTeamName && (t.subName || undefined) === (live.awayTeamSubName || undefined))?.players || [];
    
    const summary: GameSummary = JSON.parse(JSON.stringify(live.gameSummary));

    // Recalculate aggregated player stats
    const aggregatedStats = recalculateAllStatsFromLogs(summary, homeTeamRoster, awayTeamRoster);
    summary.home.playerStats = aggregatedStats.home;
    summary.away.playerStats = aggregatedStats.away;

    // Generate stats by period
    const statsByPeriod: Record<string, PeriodStats> = {};
    const playedPeriods = live.playedPeriods || [];
    
    playedPeriods.forEach(periodText => {
        statsByPeriod[periodText] = {
            home: { goals: [], penalties: [], playerStats: [] },
            away: { goals: [], penalties: [], playerStats: [] }
        };

        const periodHomeGoals = summary.home.goals.filter(g => g.periodText === periodText);
        const periodAwayGoals = summary.away.goals.filter(g => g.periodText === periodText);
        
        statsByPeriod[periodText].home.goals = periodHomeGoals;
        statsByPeriod[periodText].away.goals = periodAwayGoals;

        const periodSummaryForStats: GameSummary = {
          ...summary,
          home: {
            ...summary.home,
            goals: periodHomeGoals,
            homeShotsLog: (summary.home.homeShotsLog || []).filter(s => s.periodText === periodText),
          },
          away: {
            ...summary.away,
            goals: periodAwayGoals,
            awayShotsLog: (summary.away.awayShotsLog || []).filter(s => s.periodText === periodText),
          },
        };

        const periodPlayerStats = recalculateAllStatsFromLogs(periodSummaryForStats, homeTeamRoster, awayTeamRoster);
        statsByPeriod[periodText].home.playerStats = periodPlayerStats.home;
        statsByPeriod[periodText].away.playerStats = periodPlayerStats.away;
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
