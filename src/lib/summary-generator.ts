import type { GameState, GameSummary, PeriodStats, SummaryPlayerStats, GoalLog, ShotLog, AttendedPlayerInfo, Team, PlayerData, PenaltyLog, PeriodSummary, VoiceGameEvent } from "@/types";

export const recalculateAllStatsFromLogs = (partialSummary: Partial<{ goals: { home: GoalLog[], away: GoalLog[] }, home: { homeShotsLog?: ShotLog[] }, away: { awayShotsLog?: ShotLog[] }, attendance?: { home: AttendedPlayerInfo[], away: AttendedPlayerInfo[] } }>, homeTeamRoster: PlayerData[], awayTeamRoster: PlayerData[]): { home: SummaryPlayerStats[], away: SummaryPlayerStats[] } => {
    const homePlayerStatsMap = new Map<string, SummaryPlayerStats>();
    const awayPlayerStatsMap = new Map<string, SummaryPlayerStats>();

    // Initialize with attendance (players who actually played) if available, otherwise use roster
    const homePlayersToInit = partialSummary.attendance?.home || homeTeamRoster;
    const awayPlayersToInit = partialSummary.attendance?.away || awayTeamRoster;

    homePlayersToInit.forEach(p => homePlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));
    awayPlayersToInit.forEach(p => awayPlayerStatsMap.set(p.id, { id: p.id, name: p.name, number: p.number, shots: 0, goals: 0, assists: 0 }));

    // Process goals and assists (use attendance for lookups if available, otherwise roster)
    (partialSummary.goals?.home || []).forEach(goal => {
        const player = homePlayersToInit.find(p => p.number === goal.scorer?.playerNumber);
        if (player) {
            if (!homePlayerStatsMap.has(player.id)) {
                // Player not in map yet, create entry
                homePlayerStatsMap.set(player.id, { id: player.id, name: player.name, number: player.number, shots: 0, goals: 0, assists: 0 });
            }
            homePlayerStatsMap.get(player.id)!.goals++;
        }
        const assist = homePlayersToInit.find(p => p.number === goal.assist?.playerNumber);
        if (assist) {
            if (!homePlayerStatsMap.has(assist.id)) {
                homePlayerStatsMap.set(assist.id, { id: assist.id, name: assist.name, number: assist.number, shots: 0, goals: 0, assists: 0 });
            }
            homePlayerStatsMap.get(assist.id)!.assists++;
        }
    });
    (partialSummary.goals?.away || []).forEach(goal => {
        const player = awayPlayersToInit.find(p => p.number === goal.scorer?.playerNumber);
        if (player) {
            if (!awayPlayerStatsMap.has(player.id)) {
                awayPlayerStatsMap.set(player.id, { id: player.id, name: player.name, number: player.number, shots: 0, goals: 0, assists: 0 });
            }
            awayPlayerStatsMap.get(player.id)!.goals++;
        }
        const assist = awayPlayersToInit.find(p => p.number === goal.assist?.playerNumber);
        if (assist) {
            if (!awayPlayerStatsMap.has(assist.id)) {
                awayPlayerStatsMap.set(assist.id, { id: assist.id, name: assist.name, number: assist.number, shots: 0, goals: 0, assists: 0 });
            }
            awayPlayerStatsMap.get(assist.id)!.assists++;
        }
    });

    // Process shots
    (partialSummary.home?.homeShotsLog || []).forEach(shot => {
        if (shot.playerId) {
            if (!homePlayerStatsMap.has(shot.playerId)) {
                // Player not in map (not in attendance), try to find in roster
                const rosterPlayer = homeTeamRoster.find(p => p.id === shot.playerId);
                if (rosterPlayer) {
                    homePlayerStatsMap.set(shot.playerId, { id: rosterPlayer.id, name: rosterPlayer.name, number: rosterPlayer.number, shots: 0, goals: 0, assists: 0 });
                }
            }
            if (homePlayerStatsMap.has(shot.playerId)) {
                homePlayerStatsMap.get(shot.playerId)!.shots++;
            }
        }
    });
    (partialSummary.away?.awayShotsLog || []).forEach(shot => {
        if (shot.playerId) {
            if (!awayPlayerStatsMap.has(shot.playerId)) {
                // Player not in map (not in attendance), try to find in roster
                const rosterPlayer = awayTeamRoster.find(p => p.id === shot.playerId);
                if (rosterPlayer) {
                    awayPlayerStatsMap.set(shot.playerId, { id: rosterPlayer.id, name: rosterPlayer.name, number: rosterPlayer.number, shots: 0, goals: 0, assists: 0 });
                }
            }
            if (awayPlayerStatsMap.has(shot.playerId)) {
                awayPlayerStatsMap.get(shot.playerId)!.shots++;
            }
        }
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

    console.log('[DEBUG Summary] 🔍 Looking for rosters:', {
        homeTeamName: live.homeTeamName,
        awayTeamName: live.awayTeamName,
        homeTeamSubName: live.homeTeamSubName,
        awayTeamSubName: live.awayTeamSubName,
        selectedMatchCategory: config.selectedMatchCategory,
        tournamentTeamsCount: currentTournament?.teams?.length || 0,
        availableTeamNames: currentTournament?.teams?.map(t => ({ name: t.name, subName: t.subName, category: t.category })).slice(0, 5) || []
    });

    const homeTeamRoster = currentTournament?.teams.find(t => t.name === live.homeTeamName && (t.subName || undefined) === (live.homeTeamSubName || undefined) && t.category === config.selectedMatchCategory)?.players || [];
    const awayTeamRoster = currentTournament?.teams.find(t => t.name === live.awayTeamName && (t.subName || undefined) === (live.awayTeamSubName || undefined) && t.category === config.selectedMatchCategory)?.players || [];

    console.log('[DEBUG Summary] 🔍 Roster search results:', {
        homeRosterFound: homeTeamRoster.length > 0,
        homeRosterSize: homeTeamRoster.length,
        awayRosterFound: awayTeamRoster.length > 0,
        awayRosterSize: awayTeamRoster.length
    });

    const allPlayedPeriods = [...(live.playedPeriods || [])];

    // Helper to get period text from period number
    const getPeriodText = (periodNum: number): string => {
        if (periodNum === 1) return '1ST';
        if (periodNum === 2) return '2ND';
        if (periodNum === 3) return 'OT';
        if (periodNum === 4) return 'OT2';
        return `OT${periodNum - 2}`;
    };

    // Helper to normalize period text (convert P1 -> 1ST, P2 -> 2ND, etc.)
    const normalizePeriodText = (periodText: string): string => {
        if (periodText.startsWith('P')) {
            const periodNum = parseInt(periodText.substring(1));
            if (!isNaN(periodNum)) {
                return getPeriodText(periodNum);
            }
        }
        return periodText;
    };

    const statsByPeriodArray: PeriodSummary[] = allPlayedPeriods.map((periodText, periodIndex) => {
        const periodData: PeriodStats = {
            goals: { home: [], away: [] },
            penalties: { home: [], away: [] },
            playerStats: { home: [], away: [] }
        };

        // Filter events for the current period (normalize periodText for backwards compatibility).
        periodData.goals.home = (live.goals.home || []).filter(g => normalizePeriodText(g.periodText || '') === periodText);
        periodData.goals.away = (live.goals.away || []).filter(g => normalizePeriodText(g.periodText || '') === periodText);
        periodData.penalties.home = (live.penaltiesLog.home || []).filter(p => normalizePeriodText(p.addPeriodText || '') === periodText);
        periodData.penalties.away = (live.penaltiesLog.away || []).filter(p => normalizePeriodText(p.addPeriodText || '') === periodText);

        // Filter voice events for this period (shots from voice commands)
        const voiceEventsForPeriod = (voiceEvents || []).filter((event) => {
            if (!event.gameTime) return false;
            const eventPeriodText = getPeriodText(event.gameTime.period);
            return eventPeriodText === periodText && event.action === 'shot';
        });

        // Recalculate player stats specifically for this period.
        const periodSummaryForStats = {
          goals: periodData.goals,
          home: { homeShotsLog: (live.shotsLog.home || []).filter(s => normalizePeriodText(s.periodText || '') === periodText) },
          away: { awayShotsLog: (live.shotsLog.away || []).filter(s => normalizePeriodText(s.periodText || '') === periodText) },
          attendance: live.attendance
        };
        const periodPlayerStats = recalculateAllStatsFromLogs(periodSummaryForStats, homeTeamRoster, awayTeamRoster);
        periodData.playerStats.home = periodPlayerStats.home;
        periodData.playerStats.away = periodPlayerStats.away;

        // Add shots from voice events
        console.log(`[DEBUG Summary] 🎯 Processing voice events for period ${periodText}:`, {
            totalVoiceEvents: voiceEventsForPeriod.length,
            homeRosterCount: homeTeamRoster.length,
            awayRosterCount: awayTeamRoster.length,
            homeStatsCount: periodData.playerStats.home.length,
            awayStatsCount: periodData.playerStats.away.length
        });

        voiceEventsForPeriod.forEach((event, index) => {
            const isHome = event.data.team === 'home';
            const roster = isHome ? homeTeamRoster : awayTeamRoster;
            const statsArray = isHome ? periodData.playerStats.home : periodData.playerStats.away;

            console.log(`[DEBUG Summary] 🎯 Processing voice event ${index + 1}/${voiceEventsForPeriod.length}:`, {
                team: event.data.team,
                playerNumber: event.data.playerNumber,
                hasPlayerNumber: 'playerNumber' in event.data,
                rosterSize: roster.length
            });

            // Find player by number (only for shot events with playerNumber)
            if ('playerNumber' in event.data) {
                const player = roster.find(p => p.number === event.data.playerNumber);
                console.log(`[DEBUG Summary] 🎯 Player search result:`, {
                    searchingFor: event.data.playerNumber,
                    playerFound: !!player,
                    playerId: player?.id,
                    playerName: player?.name,
                    rosterNumbers: roster.map(p => p.number).slice(0, 10) // First 10 numbers for reference
                });

                if (player) {
                    const playerStats = statsArray.find(s => s.id === player.id);
                    console.log(`[DEBUG Summary] 🎯 PlayerStats search result:`, {
                        playerId: player.id,
                        statsFound: !!playerStats,
                        currentShots: playerStats?.shots,
                        statsArraySize: statsArray.length
                    });

                    if (playerStats) {
                        playerStats.shots++;
                        console.log(`[DEBUG Summary] 🎯 ✅ Shot incremented! New count:`, playerStats.shots);
                    } else {
                        console.log(`[DEBUG Summary] 🎯 ❌ PlayerStats not found in statsArray`);
                    }
                } else {
                    console.log(`[DEBUG Summary] 🎯 ❌ Player not found in roster`);
                }
            } else {
                console.log(`[DEBUG Summary] 🎯 ⚠️ Event missing playerNumber field`);
            }
        });

        // Log final shot counts after processing voice events
        const homePlayersWithShots = periodData.playerStats.home.filter(p => p.shots > 0);
        const awayPlayersWithShots = periodData.playerStats.away.filter(p => p.shots > 0);
        console.log(`[DEBUG Summary] 🎯 Final shot counts for period ${periodText}:`, {
            homePlayersWithShots: homePlayersWithShots.length,
            awayPlayersWithShots: awayPlayersWithShots.length,
            homePlayers: homePlayersWithShots.map(p => `#${p.number}:${p.shots}shots`),
            awayPlayers: awayPlayersWithShots.map(p => `#${p.number}:${p.shots}shots`)
        });

        // Get period duration (from config, defaulting to standard period length)
        const periodDuration = config.defaultPeriodDuration || 120000; // 20 minutes default

        // Add goalkeeper changes log for this period
        let goalkeeperChangesLog = {
            home: (live.goalkeeperChangesLog?.home || []).filter(gc => normalizePeriodText(gc.periodText || '') === periodText),
            away: (live.goalkeeperChangesLog?.away || []).filter(gc => normalizePeriodText(gc.periodText || '') === periodText)
        };

        // For the first actual game period, also include goalkeeper changes from pre-game periods
        // (Pre Warm-up, Warm-up, Break) so that goalkeepers set before the game starts are tracked
        const isFirstGamePeriod = periodIndex === 0;
        if (isFirstGamePeriod) {
            const preGamePeriods = ['Pre Warm-up', 'Warm-up', 'Break'];
            const preGameGKChangesHome = (live.goalkeeperChangesLog?.home || [])
                .filter(gc => preGamePeriods.includes(gc.periodText || ''))
                .map(gc => ({
                    ...gc,
                    // Adjust gameTime to period start (periodDuration) since they start from beginning of actual period
                    gameTime: periodDuration
                }));
            const preGameGKChangesAway = (live.goalkeeperChangesLog?.away || [])
                .filter(gc => preGamePeriods.includes(gc.periodText || ''))
                .map(gc => ({
                    ...gc,
                    // Adjust gameTime to period start (periodDuration) since they start from beginning of actual period
                    gameTime: periodDuration
                }));

            // Merge pre-game changes with current period changes
            // Pre-game changes should come first (they happened earlier)
            goalkeeperChangesLog = {
                home: [...preGameGKChangesHome, ...goalkeeperChangesLog.home],
                away: [...preGameGKChangesAway, ...goalkeeperChangesLog.away]
            };
        }

        return { period: periodText, stats: periodData, goalkeeperChangesLog, periodDuration };
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
