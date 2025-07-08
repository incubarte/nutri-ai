
import { NextResponse } from 'next/server';
import { getGameState, gameStateEmitter } from '@/lib/server-side-store';
import type { LiveGameState } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let intervalId: NodeJS.Timeout;

      const onUpdate = (state: LiveGameState) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(state)}\n\n`));
        } catch (e) {
          console.error("Failed to enqueue data, stream might be closed.", e);
        }
      };

      const cleanup = () => {
        console.log('SSE: Cleaning up resources.');
        clearInterval(intervalId);
        gameStateEmitter.off('update', onUpdate);
      };

      gameStateEmitter.on('update', onUpdate);

      intervalId = setInterval(() => {
        try {
            controller.enqueue(encoder.encode(':ping\n\n'));
        } catch (e) {
            console.log('SSE: Ping failed, client disconnected.');
            cleanup();
        }
      }, 30000);

      request.signal.onabort = () => {
        console.log('SSE: Client disconnected via abort signal.');
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
