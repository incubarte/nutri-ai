
import { NextResponse } from 'next/server';
import { getGameState, getConfig } from '@/lib/server-side-store';
import type { LiveGameState, PenaltyTypeDefinition, MobileData } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const liveState = getGameState();
    const config = getConfig();

    if (!liveState || !config) {
      // This can happen if the server just started and no state has been posted yet.
      // We could try to read from the file as a fallback, but for a simple GET
      // it's better to show that the game might not be active.
      return NextResponse.json({ message: 'Game state not initialized on the server yet.' }, { status: 404 });
    }

    const dataForMobile: MobileData = {
        gameState: liveState,
        penaltyConfig: {
            penaltyTypes: config.penaltyTypes || [],
            defaultPenaltyTypeId: config.defaultPenaltyTypeId || null,
        }
    };
    
    return NextResponse.json(dataForMobile);
  } catch (error) {
    console.error("Error fetching live game state:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json({ error: `Internal server error: ${errorMessage}` }, { status: 500 });
  }
}
