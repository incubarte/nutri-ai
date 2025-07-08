
import { getGameState } from '@/lib/server-side-store';
import { NextResponse } from 'next/server';
import type { LiveGameState } from '@/types';
import { setGameState as setServerGameState } from '@/lib/server-side-store';

export async function GET(request: Request) {
  const gameState = getGameState();
  return NextResponse.json(gameState);
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
