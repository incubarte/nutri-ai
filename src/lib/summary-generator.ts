import type { GameState, GameSummary, PeriodStats, SummaryPlayerStats, GoalLog, ShotLog, AttendedPlayerInfo, Team, PlayerData, PenaltyLog, PeriodSummary, VoiceGameEvent } from "@/types";

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


export const generateSummaryData = (state: GameState, voiceEvents?: VoiceGameEvent[]): GameSummary | null => {
    const { live, config } = state;
    if (!live || !config) return null;

    // If voice events not provided and we're on server, try to read them from file
    if (!voiceEvents && live.matchId && config.selectedTournamentId && typeof window === 'undefined') {
        try {
            const fs = require('fs');
            const path = require('path');
            const voiceEventsPath = path.join(
                process.cwd(),
                'tmp', 'new-storage', 'data', 'tournaments',
                config.selectedTournamentId,
                'voice-events',
                `${live.matchId}.json`
            );
            if (fs.existsSync(voiceEventsPath)) {
                const voiceEventsData = fs.readFileSync(voiceEventsPath, 'utf-8');
                voiceEvents = JSON.parse(voiceEventsData);
                console.log(`[Summary Generator] Loaded ${voiceEvents?.length || 0} voice events from file for match ${live.matchId}`);
            }
        } catch (error) {
            console.warn('[Summary Generator] Could not read voice events file:', error);
        }
    }

    const currentTournament = config.tournaments.find(t => t.id === config.selectedTournamentId);
    const homeTeamRoster = currentTournament?.teams.find(t => t.name === live.homeTeamName && (t.subName || undefined) === (live.homeTeamSubName || undefined) && t.category === config.selectedMatchCategory)?.players || [];
    const awayTeamRoster = currentTournament?.teams.find(t => t.name === live.awayTeamName && (t.subName || undefined) === (live.awayTeamSubName || undefined) && t.category === config.selectedMatchCategory)?.players || [];

    const allPlayedPeriods = [...(live.playedPeriods || [])];

    // Helper to get period text from period number
    const getPeriodText = (periodNum: number): string => {
        if (periodNum === 1) return '1ST';
        if (periodNum === 2) return '2ND';
        if (periodNum === 3) return 'OT';
        if (periodNum === 4) return 'OT2';
        return `OT${periodNum - 2}`;
    };

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

        // Filter voice events for this period (shots from voice commands)
        const voiceEventsForPeriod = (voiceEvents || []).filter((event) => {
            if (!event.gameTime) return false;
            const eventPeriodText = getPeriodText(event.gameTime.period);
            return eventPeriodText === periodText && event.action === 'shot';
        });

        // Recalculate player stats specifically for this period.
        const periodSummaryForStats = {
          goals: periodData.goals,
          home: { homeShotsLog: (live.shotsLog.home || []).filter(s => s.periodText === periodText) },
          away: { awayShotsLog: (live.shotsLog.away || []).filter(s => s.periodText === periodText) },
        };
        const periodPlayerStats = recalculateAllStatsFromLogs(periodSummaryForStats, homeTeamRoster, awayTeamRoster);
        periodData.playerStats.home = periodPlayerStats.home;
        periodData.playerStats.away = periodPlayerStats.away;

        // Add shots from voice events
        voiceEventsForPeriod.forEach((event) => {
            const isHome = event.data.team === 'home';
            const roster = isHome ? homeTeamRoster : awayTeamRoster;
            const statsArray = isHome ? periodData.playerStats.home : periodData.playerStats.away;

            // Find player by number (only for shot events with playerNumber)
            if ('playerNumber' in event.data) {
                const player = roster.find(p => p.number === event.data.playerNumber);
                if (player) {
                    const playerStats = statsArray.find(s => s.id === player.id);
                    if (playerStats) {
                        playerStats.shots++;
                    }
                }
            }
        });

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

    // Include voice events in the summary for historical record
    if (voiceEvents && voiceEvents.length > 0) {
        (finalSummary as any).voiceEvents = voiceEvents;
    }

    return finalSummary;
};
