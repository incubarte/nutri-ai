
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import type { GameState, ConfigState, Tournament, TeamData, CategoryData, MatchData, LiveState, PeriodSummary } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const LIVE_STATE_PATH = path.join(DATA_DIR, 'live.json');
const TOURNAMENTS_DIR = path.join(DATA_DIR, 'tournaments');

async function readData(filePath: string): Promise<any> {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null; // File doesn't exist, which is fine
        }
        console.error(`Could not read ${filePath}:`, error);
        throw new Error(`Failed to read database file: ${path.basename(filePath)}`);
    }
}

async function writeData(filePath: string, data: any): Promise<void> {
    try {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
        console.error(`Could not write to ${filePath}:`, error);
        throw new Error(`Failed to write to database file: ${path.basename(filePath)}`);
    }
}


export async function GET(request: Request) {
  try {
    const [config, liveState] = await Promise.all([
        readData(CONFIG_PATH),
        readData(LIVE_STATE_PATH)
    ]);
    
    const fullConfig = config || {};
    
    const initialState: Partial<GameState> = {
      config: fullConfig,
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
  try {
    const { config, live } = await request.json() as { config?: ConfigState; live?: LiveState };

    if (config) {
        // Save only config metadata, not the full tournament objects
        const { tournaments, ...baseConfig } = config;
        const tournamentMetas = (tournaments || []).map(t => ({ id: t.id, name: t.name, status: t.status }));
        const configToSave = { ...baseConfig, tournaments: tournamentMetas };
        
        await writeData(CONFIG_PATH, configToSave);
    }
    
    if (live) {
        await writeData(LIVE_STATE_PATH, live);
    }

    return NextResponse.json({ success: true, message: 'Data saved successfully.' });
  } catch (error) {
     if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred.'}, { status: 500 });
  }
}
