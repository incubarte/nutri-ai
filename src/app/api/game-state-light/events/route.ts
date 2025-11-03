
import { NextResponse } from 'next/server';
import { gameStateEmitter } from '@/lib/server-side-store';
import type { LiveGameState } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let intervalId: NodeJS.Timeout;

      const onUpdate = (state: LiveGameState) => {
        try {
          // Create the lightweight version of the game state
          const lightGameState = {
            score: state.score,
            penalties: state.penalties,
            goals: state.goals,
            clock: state.clock,
            shootout: state.shootout,
            homeTeamName: state.homeTeamName,
            awayTeamName: state.awayTeamName,
            homeTeamSubName: state.homeTeamSubName,
            awayTeamSubName: state.awayTeamSubName,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(lightGameState)}\n\n`));
        } catch (e) {
          console.error("Failed to enqueue lightweight game state data, stream might be closed.", e);
        }
      };
      
      const cleanup = () => {
        console.log('Light Game State SSE: Cleaning up resources.');
        clearInterval(intervalId);
        gameStateEmitter.off('update', onUpdate);
      };

      gameStateEmitter.on('update', onUpdate);

      // Keep-alive ping
      intervalId = setInterval(() => {
        try {
            controller.enqueue(encoder.encode(':ping\n\n'));
        } catch (e) {
            console.log('Light Game State SSE: Ping failed, client may have disconnected.');
            cleanup();
        }
      }, 30000);

      request.signal.onabort = () => {
        console.log('Light Game State SSE: Client disconnected via abort signal.');
        cleanup();
      };
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
