
import { NextResponse } from 'next/server';
import type { GameState, ConfigState, LiveState } from '@/types';
import { setGameState, setConfig } from '@/lib/server-side-store';
import { readConfig, writeConfig, readLiveState, writeLiveState } from '@/lib/storage';

export async function GET(request: Request) {
  try {
    const [config, liveState] = await Promise.all([
        readConfig(),
        readLiveState()
    ]);
    
    // Store in-memory for other API routes to access
    if (config) setConfig(config as ConfigState);
    if (liveState) setGameState(liveState as LiveState);

    const initialState: Partial<GameState> = {
      config: config || {},
      live: liveState || {}, 
      _initialConfigLoadComplete: false,
    }

    return NextResponse.json(initialState);
  } catch (error) {
    if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred on the server.'}, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_READ_ONLY === 'true') {
    return NextResponse.json({ success: false, message: 'La aplicación está en modo de solo lectura. No se permiten escrituras.' }, { status: 403 });
  }

  try {
    const { config, live } = await request.json() as { config?: ConfigState; live?: LiveState };

    if (config) {
        const { tournaments, ...baseConfig } = config;
        const tournamentMetas = (tournaments || []).map(t => ({ id: t.id, name: t.name, status: t.status }));
        const configToSave = { ...baseConfig, tournaments: tournamentMetas };
        
        await writeConfig(configToSave as ConfigState);
        setConfig(config); // Update in-memory store
    }
    
    if (live) {
        await writeLiveState(live);
        setGameState(live); // Update in-memory store and emit event
    }

    return NextResponse.json({ success: true, message: 'Data saved successfully.' });
  } catch (error) {
     if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred.'}, { status: 500 });
  }
}
