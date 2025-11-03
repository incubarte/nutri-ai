
import { NextResponse } from 'next/server';
import { getGameState } from '@/lib/server-side-store';
import type { LiveGameState } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const liveState = getGameState();

    if (!liveState) {
      return NextResponse.json({ message: 'Game state not initialized on the server yet.' }, { status: 404 });
    }

    // Create a lightweight version of the game state
    const lightGameState = {
      score: liveState.score,
      penalties: liveState.penalties,
      goals: liveState.goals,
      clock: liveState.clock,
      shootout: liveState.shootout,
      homeTeamName: liveState.homeTeamName,
      awayTeamName: liveState.awayTeamName,
      homeTeamSubName: liveState.homeTeamSubName,
      awayTeamSubName: liveState.awayTeamSubName,
    };
    
    return NextResponse.json(lightGameState);
  } catch (error) {
    console.error("Error fetching lightweight game state:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}
