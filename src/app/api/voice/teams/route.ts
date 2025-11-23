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

    // Extract players from attendance
    const homePlayers = (liveState.attendance?.home || []).map((p: any) => ({
      id: p.id,
      number: p.number || '',
      name: p.name || 'Sin nombre'
    }));

    const awayPlayers = (liveState.attendance?.away || []).map((p: any) => ({
      id: p.id,
      number: p.number || '',
      name: p.name || 'Sin nombre'
    }));

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
