import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  try {
    // Read live game state
    const livePath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'live.json');
    const liveData = await readFile(livePath, 'utf-8');
    const liveState = JSON.parse(liveData);

    const homeTeamName = liveState.homeTeamName || 'Equipo Local';
    const awayTeamName = liveState.awayTeamName || 'Equipo Visitante';
    const homeTeamSubName = liveState.homeTeamSubName || undefined;
    const awayTeamSubName = liveState.awayTeamSubName || undefined;

    // Extract attendance with isPresent flag
    const attendanceHomeMap = new Map((liveState.attendance?.home || []).map((p: any) => [p.id, p.isPresent !== false]));
    const attendanceAwayMap = new Map((liveState.attendance?.away || []).map((p: any) => [p.id, p.isPresent !== false]));

    // Get full team rosters from tournament
    const configPath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'config.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);
    const tournamentId = config.selectedTournamentId;

    let allHomePlayers: any[] = [];
    let allAwayPlayers: any[] = [];

    if (tournamentId) {
      try {
        // Read teams from the tournament's teams.json file
        const teamsPath = path.join(
          process.cwd(),
          'tmp', 'new-storage', 'data', 'tournaments',
          tournamentId,
          'teams.json'
        );
        const teamsData = await readFile(teamsPath, 'utf-8');
        const teamsFile = JSON.parse(teamsData);

        if (teamsFile.teams) {
          // Match by name and subName
          const homeTeamData = teamsFile.teams.find((t: any) =>
            t.name === homeTeamName &&
            (t.subName || undefined) === homeTeamSubName
          );
          const awayTeamData = teamsFile.teams.find((t: any) =>
            t.name === awayTeamName &&
            (t.subName || undefined) === awayTeamSubName
          );

          if (homeTeamData?.players) {
            allHomePlayers = homeTeamData.players.map((p: any) => ({
              id: p.id,
              number: p.number || '',
              name: p.name || 'Sin nombre',
              isPresent: attendanceHomeMap.get(p.id) || false
            }));
          }

          if (awayTeamData?.players) {
            allAwayPlayers = awayTeamData.players.map((p: any) => ({
              id: p.id,
              number: p.number || '',
              name: p.name || 'Sin nombre',
              isPresent: attendanceAwayMap.get(p.id) || false
            }));
          }
        }
      } catch (error) {
        console.error('Could not load full roster:', error);
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
