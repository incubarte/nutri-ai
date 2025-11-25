import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

async function getTournamentIdFromMatch(matchId: string): Promise<string | null> {
  try {
    const configPath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'config.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    return config.selectedTournamentId || null;
  } catch (error) {
    return null;
  }
}

export async function GET() {
  try {
    // Read live game state
    const livePath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'live.json');
    const liveData = await readFile(livePath, 'utf-8');
    const liveState = JSON.parse(liveData);

    const homeTeamName = liveState.homeTeamName || 'Equipo Local';
    const awayTeamName = liveState.awayTeamName || 'Equipo Visitante';

    // Extract players from attendance (these are the ones present)
    const attendanceHomeIds = new Set((liveState.attendance?.home || []).map((p: any) => p.id));
    const attendanceAwayIds = new Set((liveState.attendance?.away || []).map((p: any) => p.id));

    // Get full team rosters from tournament
    const tournamentId = liveState.matchId ? await getTournamentIdFromMatch(liveState.matchId) : null;
    let allHomePlayers: any[] = [];
    let allAwayPlayers: any[] = [];

    if (tournamentId) {
      try {
        const configPath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'config.json');
        const configData = await readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);

        const tournament = config.tournaments?.find((t: any) => t.id === tournamentId);
        if (tournament?.teams) {
          const homeTeamData = tournament.teams.find((t: any) => t.name === homeTeamName);
          const awayTeamData = tournament.teams.find((t: any) => t.name === awayTeamName);

          if (homeTeamData?.players) {
            allHomePlayers = homeTeamData.players.map((p: any) => ({
              id: p.id,
              number: p.number || '',
              name: p.name || 'Sin nombre',
              isPresent: attendanceHomeIds.has(p.id)
            }));
          }

          if (awayTeamData?.players) {
            allAwayPlayers = awayTeamData.players.map((p: any) => ({
              id: p.id,
              number: p.number || '',
              name: p.name || 'Sin nombre',
              isPresent: attendanceAwayIds.has(p.id)
            }));
          }
        }
      } catch (error) {
        console.error('[Voice Teams] Could not load full roster:', error);
      }
    }

    // If no roster found, use attendance only
    if (allHomePlayers.length === 0) {
      allHomePlayers = (liveState.attendance?.home || []).map((p: any) => ({
        id: p.id,
        number: p.number || '',
        name: p.name || 'Sin nombre',
        isPresent: true
      }));
    }

    if (allAwayPlayers.length === 0) {
      allAwayPlayers = (liveState.attendance?.away || []).map((p: any) => ({
        id: p.id,
        number: p.number || '',
        name: p.name || 'Sin nombre',
        isPresent: true
      }));
    }

    // Sort by number (numeric sort)
    const sortByNumber = (a: any, b: any) => {
      const numA = parseInt(a.number) || 999;
      const numB = parseInt(b.number) || 999;
      return numA - numB;
    };

    const homePlayers = allHomePlayers.sort(sortByNumber);
    const awayPlayers = allAwayPlayers.sort(sortByNumber);

    return NextResponse.json({
      success: true,
      homeTeam: {
        name: homeTeamName,
        players: homePlayers
      },
      awayTeam: {
        name: awayTeamName,
        players: awayPlayers
      }
    });

  } catch (error) {
    console.error('Error loading team data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load team data'
    }, { status: 500 });
  }
}
