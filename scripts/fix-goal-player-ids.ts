/**
 * Script para agregar playerId a los goles en los summaries existentes
 *
 * Este script:
 * 1. Lee todos los summaries de todos los torneos
 * 2. Para cada gol, busca el playerId basándose en el nombre del jugador
 * 3. Actualiza el summary con el playerId correcto
 *
 * Uso: npx tsx scripts/fix-goal-player-ids.ts
 */

import fs from 'fs/promises';
import path from 'path';

interface PlayerData {
    id: string;
    name: string;
    number: string;
    type?: 'player' | 'goalkeeper';
    photoFileName?: string;
}

interface TeamData {
    id: string;
    name: string;
    players: PlayerData[];
}

interface Tournament {
    id: string;
    name: string;
    teams?: TeamData[];
    matches?: any[];
}

interface GoalLog {
    id: string;
    team: 'home' | 'away';
    timestamp: number;
    gameTime: number;
    periodText: string;
    scorer?: {
        playerId?: string;
        playerNumber: string;
        playerName?: string;
    };
    assist?: {
        playerId?: string;
        playerNumber: string;
        playerName?: string;
    };
    assist2?: {
        playerId?: string;
        playerNumber: string;
        playerName?: string;
    };
}

interface PenaltyLog {
    id: string;
    team: 'home' | 'away';
    playerId?: string;
    playerNumber: string;
    playerName?: string;
    penaltyName?: string;
    [key: string]: any;
}

interface PeriodStats {
    period: string;
    stats: {
        goals?: {
            home: GoalLog[];
            away: GoalLog[];
        };
        penalties?: {
            home: PenaltyLog[];
            away: PenaltyLog[];
        };
        [key: string]: any;
    };
}

interface GameSummary {
    goals?: {
        home: GoalLog[];
        away: GoalLog[];
    };
    penalties?: {
        home: PenaltyLog[];
        away: PenaltyLog[];
    };
    statsByPeriod?: PeriodStats[];
    [key: string]: any;
}

function getDataDir(): string {
    const storagePath = process.env.STORAGE_PATH;
    if (storagePath) {
        if (path.isAbsolute(storagePath)) {
            return path.join(storagePath, 'data');
        }
        return path.join(process.cwd(), storagePath, 'data');
    }
    return path.join(process.cwd(), 'storage', 'data');
}

function normalizePlayerName(name: string): string {
    return name.toLowerCase().trim();
}

function findPlayerByName(teams: TeamData[], playerName: string, teamId: string): PlayerData | null {
    if (!playerName) return null;

    const normalizedName = normalizePlayerName(playerName);

    // Primero buscar en el equipo específico
    const team = teams.find(t => t.id === teamId);
    if (team) {
        const player = team.players.find(p => normalizePlayerName(p.name) === normalizedName);
        if (player) return player;
    }

    // Si no se encuentra, buscar en todos los equipos (por si cambió de equipo)
    for (const team of teams) {
        const player = team.players.find(p => normalizePlayerName(p.name) === normalizedName);
        if (player) {
            console.log(`  ⚠️  Jugador "${playerName}" encontrado en equipo diferente: ${team.name}`);
            return player;
        }
    }

    return null;
}

async function fixSummary(
    summaryPath: string,
    homeTeamId: string,
    awayTeamId: string,
    teams: TeamData[]
): Promise<{ updated: boolean; goalsFixed: number; penaltiesFixed: number; positivesFixed: number; negativesFixed: number }> {
    let goalsFixed = 0;
    let penaltiesFixed = 0;
    let positivesFixed = 0;
    let negativesFixed = 0;
    let updated = false;

    try {
        const summaryContent = await fs.readFile(summaryPath, 'utf-8');
        const summary: GameSummary = JSON.parse(summaryContent);

        // Helper function to process goals
        const processGoals = (goals: GoalLog[], teamId: string, teamType: 'home' | 'away') => {
            for (const goal of goals) {
                // Fix scorer
                if (goal.scorer && !goal.scorer.playerId && goal.scorer.playerName) {
                    const player = findPlayerByName(teams, goal.scorer.playerName, teamId);
                    if (player) {
                        goal.scorer.playerId = player.id;
                        goalsFixed++;
                        updated = true;
                        console.log(`    ✅ Scorer (${teamType}): ${goal.scorer.playerName} -> ${player.id}`);
                    } else {
                        console.log(`    ❌ No se encontró (${teamType}): ${goal.scorer.playerName}`);
                    }
                }

                // Fix assist
                if (goal.assist && !goal.assist.playerId && goal.assist.playerName) {
                    const player = findPlayerByName(teams, goal.assist.playerName, teamId);
                    if (player) {
                        goal.assist.playerId = player.id;
                        goalsFixed++;
                        updated = true;
                        console.log(`    ✅ Assist (${teamType}): ${goal.assist.playerName} -> ${player.id}`);
                    } else {
                        console.log(`    ❌ No se encontró (${teamType}): ${goal.assist.playerName}`);
                    }
                }

                // Fix assist2
                if (goal.assist2 && !goal.assist2.playerId && goal.assist2.playerName) {
                    const player = findPlayerByName(teams, goal.assist2.playerName, teamId);
                    if (player) {
                        goal.assist2.playerId = player.id;
                        goalsFixed++;
                        updated = true;
                        console.log(`    ✅ Assist2 (${teamType}): ${goal.assist2.playerName} -> ${player.id}`);
                    } else {
                        console.log(`    ❌ No se encontró (${teamType}): ${goal.assist2.playerName}`);
                    }
                }

                // Fix positives
                if (goal.positives) {
                    for (const positive of goal.positives) {
                        if (positive && !positive.playerId && positive.playerName) {
                            const player = findPlayerByName(teams, positive.playerName, teamId);
                            if (player) {
                                positive.playerId = player.id;
                                positivesFixed++;
                                updated = true;
                                console.log(`    ✅ Positive (${teamType}): ${positive.playerName} -> ${player.id}`);
                            } else {
                                console.log(`    ❌ No se encontró positive (${teamType}): ${positive.playerName}`);
                            }
                        }
                    }
                }

                // Fix negatives
                if (goal.negatives) {
                    for (const negative of goal.negatives) {
                        if (negative && !negative.playerId && negative.playerName) {
                            const player = findPlayerByName(teams, negative.playerName, teamId);
                            if (player) {
                                negative.playerId = player.id;
                                negativesFixed++;
                                updated = true;
                                console.log(`    ✅ Negative (${teamType}): ${negative.playerName} -> ${player.id}`);
                            } else {
                                console.log(`    ❌ No se encontró negative (${teamType}): ${negative.playerName}`);
                            }
                        }
                    }
                }
            }
        };

        // Helper function to process penalties
        const processPenalties = (penalties: PenaltyLog[], teamId: string, teamType: 'home' | 'away') => {
            for (const penalty of penalties) {
                if (!penalty.playerId && penalty.playerName) {
                    const player = findPlayerByName(teams, penalty.playerName, teamId);
                    if (player) {
                        penalty.playerId = player.id;
                        penaltiesFixed++;
                        updated = true;
                        console.log(`    ✅ Penalty (${teamType}): ${penalty.playerName} -> ${player.id}`);
                    } else {
                        console.log(`    ❌ No se encontró penalty (${teamType}): ${penalty.playerName}`);
                    }
                }
            }
        };

        // Procesar goles en summary.goals (si existe)
        if (summary.goals) {
            if (summary.goals.home) {
                processGoals(summary.goals.home, homeTeamId, 'home');
            }
            if (summary.goals.away) {
                processGoals(summary.goals.away, awayTeamId, 'away');
            }
        }

        // Procesar goles en statsByPeriod (si existe)
        if (summary.statsByPeriod) {
            for (const periodStat of summary.statsByPeriod) {
                if (periodStat.stats.goals) {
                    if (periodStat.stats.goals.home) {
                        processGoals(periodStat.stats.goals.home, homeTeamId, 'home');
                    }
                    if (periodStat.stats.goals.away) {
                        processGoals(periodStat.stats.goals.away, awayTeamId, 'away');
                    }
                }
                // Procesar penalties en statsByPeriod
                if (periodStat.stats.penalties) {
                    if (periodStat.stats.penalties.home) {
                        processPenalties(periodStat.stats.penalties.home, homeTeamId, 'home');
                    }
                    if (periodStat.stats.penalties.away) {
                        processPenalties(periodStat.stats.penalties.away, awayTeamId, 'away');
                    }
                }
            }
        }

        // Procesar penalties en summary.penalties (si existe)
        if (summary.penalties) {
            if (summary.penalties.home) {
                processPenalties(summary.penalties.home, homeTeamId, 'home');
            }
            if (summary.penalties.away) {
                processPenalties(summary.penalties.away, awayTeamId, 'away');
            }
        }

        // Guardar cambios si hubo actualizaciones
        if (updated) {
            await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), 'utf-8');
        }

        return { updated, goalsFixed, penaltiesFixed, positivesFixed, negativesFixed };
    } catch (error) {
        console.error(`  ❌ Error procesando ${summaryPath}:`, error);
        return { updated: false, goalsFixed: 0, penaltiesFixed: 0, positivesFixed: 0, negativesFixed: 0 };
    }
}

async function main() {
    console.log('🔧 Iniciando migración de playerIds en goles, penalidades y positivos/negativos...\n');

    const dataDir = getDataDir();
    console.log(`📁 Data directory: ${dataDir}\n`);

    // Leer tournaments.json para obtener la lista de equipos
    const tournamentsPath = path.join(dataDir, 'tournaments.json');
    let tournaments: Tournament[] = [];

    try {
        const tournamentsContent = await fs.readFile(tournamentsPath, 'utf-8');
        const tournamentsData = JSON.parse(tournamentsContent);
        // El archivo puede ser un array directo o un objeto con propiedad "tournaments"
        tournaments = Array.isArray(tournamentsData) ? tournamentsData : tournamentsData.tournaments || [];
        console.log(`📋 Cargados ${tournaments.length} torneos\n`);
    } catch (error) {
        console.error('❌ Error leyendo tournaments.json:', error);
        process.exit(1);
    }

    let totalSummariesProcessed = 0;
    let totalSummariesUpdated = 0;
    let totalGoalsFixed = 0;
    let totalPenaltiesFixed = 0;
    let totalPositivesFixed = 0;
    let totalNegativesFixed = 0;

    // Procesar cada torneo
    for (const tournament of tournaments) {
        console.log(`\n🏆 Procesando torneo: ${tournament.name} (${tournament.id})`);

        const tournamentDir = path.join(dataDir, 'tournaments', tournament.id);

        // Leer teams.json para obtener los equipos
        const teamsFilePath = path.join(tournamentDir, 'teams.json');
        let teams: TeamData[] = [];

        try {
            const teamsContent = await fs.readFile(teamsFilePath, 'utf-8');
            const teamsData = JSON.parse(teamsContent);
            teams = Array.isArray(teamsData) ? teamsData : teamsData.teams || [];
            console.log(`  📋 Cargados ${teams.length} equipos`);
        } catch (error) {
            console.log(`  ⚠️  No se pudo leer teams.json, saltando...`);
            continue;
        }

        if (teams.length === 0) {
            console.log('  ⚠️  No hay equipos en este torneo, saltando...');
            continue;
        }

        // Leer fixture.json para obtener los matches
        const fixtureFilePath = path.join(tournamentDir, 'fixture.json');
        let matches: any[] = [];

        try {
            const content = await fs.readFile(fixtureFilePath, 'utf-8');
            const fixtureData = JSON.parse(content);
            matches = Array.isArray(fixtureData) ? fixtureData : fixtureData.matches || [];
        } catch (error) {
            console.log(`  ⚠️  No se pudo leer fixture.json, saltando...`);
            continue;
        }

        if (matches.length === 0) {
            console.log('  ℹ️  No hay partidos en este torneo');
            continue;
        }

        // Procesar cada partido
        for (const match of matches) {
            const summaryPath = path.join(tournamentDir, 'summaries', `${match.id}.json`);

            try {
                await fs.access(summaryPath);
            } catch {
                // Summary no existe, saltar
                continue;
            }

            console.log(`\n  📄 Partido: ${match.homeTeamId} vs ${match.awayTeamId}`);
            totalSummariesProcessed++;

            const result = await fixSummary(
                summaryPath,
                match.homeTeamId,
                match.awayTeamId,
                teams
            );

            if (result.updated) {
                totalSummariesUpdated++;
                totalGoalsFixed += result.goalsFixed;
                totalPenaltiesFixed += result.penaltiesFixed;
                totalPositivesFixed += result.positivesFixed;
                totalNegativesFixed += result.negativesFixed;

                const updates: string[] = [];
                if (result.goalsFixed > 0) updates.push(`${result.goalsFixed} goles`);
                if (result.penaltiesFixed > 0) updates.push(`${result.penaltiesFixed} penalidades`);
                if (result.positivesFixed > 0) updates.push(`${result.positivesFixed} positivos`);
                if (result.negativesFixed > 0) updates.push(`${result.negativesFixed} negativos`);

                console.log(`  ✨ Actualizado: ${updates.join(', ')}`);
            } else {
                console.log(`  ✓ Sin cambios necesarios`);
            }
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Resumen de la migración:');
    console.log(`  - Summaries procesados: ${totalSummariesProcessed}`);
    console.log(`  - Summaries actualizados: ${totalSummariesUpdated}`);
    console.log(`  - Goles corregidos: ${totalGoalsFixed}`);
    console.log(`  - Penalidades corregidas: ${totalPenaltiesFixed}`);
    console.log(`  - Positivos corregidos: ${totalPositivesFixed}`);
    console.log(`  - Negativos corregidos: ${totalNegativesFixed}`);
    console.log('='.repeat(50));
    console.log('\n✅ Migración completada!\n');
}

main().catch(console.error);
