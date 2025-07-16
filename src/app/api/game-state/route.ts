
import { getGameState, getConfig } from '@/lib/server-side-store';
import { NextResponse } from 'next/server';
import type { LiveGameState } from '@/types';
import { setGameState as setServerGameState } from '@/lib/server-side-store';

export async function GET(request: Request) {
  const gameState = getGameState();
  const config = getConfig();
  
  // Safely construct the response payload to avoid errors when state is null.
  // This prevents server timeouts caused by spreading a null gameState.
  const responsePayload: LiveGameState = {
    clock: gameState?.clock ?? { currentTime: 0, currentPeriod: 0, isClockRunning: false, periodDisplayOverride: null, preTimeoutState: null, clockStartTimeMs: null, remainingTimeAtStartCs: null, absoluteElapsedTimeCs: 0, _liveAbsoluteElapsedTimeCs: 0 },
    score: {
      home: gameState?.score?.home ?? 0,
      away: gameState?.score?.away ?? 0,
      homeShots: gameState?.score?.homeShots ?? 0,
      awayShots: gameState?.score?.awayShots ?? 0,
      homeGoals: gameState?.score?.homeGoals ?? [],
      awayGoals: gameState?.score?.awayGoals ?? [],
    },
    penalties: gameState?.penalties ?? { home: [], away: [] },
    homeTeamName: gameState?.homeTeamName ?? 'Local',
    awayTeamName: gameState?.awayTeamName ?? 'Visitante',
    homeTeamSubName: gameState?.homeTeamSubName,
    awayTeamSubName: gameState?.awayTeamSubName,
    gameSummary: gameState?.gameSummary,
    // Config fields needed for remote controls
    penaltyTypes: config?.penaltyTypes || [],
    defaultPenaltyTypeId: config?.defaultPenaltyTypeId || null,
    teams: config?.teams || [],
    selectedMatchCategory: config?.selectedMatchCategory || '',
    playersPerTeamOnIce: config?.playersPerTeamOnIce,
    numberOfRegularPeriods: config?.numberOfRegularPeriods,
  };

  return NextResponse.json(responsePayload);
}

export async function POST(request: Request) {
  try {
    const gameStateData = (await request.json()) as LiveGameState;
    if (!gameStateData || !gameStateData.clock || !gameStateData.score || !gameStateData.penalties) {
      return NextResponse.json({ message: 'Invalid game state data provided.' }, { status: 400 });
    }

    setServerGameState(gameStateData);

    return NextResponse.json({ message: 'Game state updated successfully.' }, { status: 200 });
  } catch (error) {
    console.error('API Error: Failed to update game state', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to update game state.', error: errorMessage }, { status: 500 });
  }
}
