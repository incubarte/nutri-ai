
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import type { GameState, ConfigState, Tournament } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const TOURNAMENTS_DIR = path.join(DATA_DIR, 'tournaments');

async function readConfig(): Promise<ConfigState> {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Could not read config.json:", error);
        // This could be customized to return a default state if the file is missing/corrupt
        throw new Error("Failed to read database file.");
    }
}

async function writeConfig(config: ConfigState): Promise<void> {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    } catch (error) {
        console.error("Could not write to config.json:", error);
        throw new Error("Failed to write to database file.");
    }
}

async function readTournament(id: string): Promise<Tournament | null> {
    const filePath = path.join(TOURNAMENTS_DIR, `${id}.json`);
    try {
        await fs.mkdir(TOURNAMENTS_DIR, { recursive: true });
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // It's okay if a tournament file doesn't exist, just return null.
        return null;
    }
}

async function writeTournament(tournament: Tournament): Promise<void> {
    const filePath = path.join(TOURNAMENTS_DIR, `${tournament.id}.json`);
    try {
        await fs.mkdir(TOURNAMENTS_DIR, { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(tournament, null, 2), 'utf-8');
    } catch (error) {
         console.error(`Could not write to tournament file ${tournament.id}.json:`, error);
        throw new Error("Failed to write tournament file.");
    }
}


export async function GET(request: Request) {
  try {
    const config = await readConfig();
    
    const tournamentPromises = config.tournaments.map(t => readTournament(t.id));
    const tournamentDetails = await Promise.all(tournamentPromises);

    const fullConfig: ConfigState = {
        ...config,
        tournaments: config.tournaments.map((meta, index) => ({
            ...meta,
            ...(tournamentDetails[index] || {}), // Merge details, keeping meta if file is missing
        }))
    };
    
    // We construct a full GameState object for the client
    const initialState: GameState = {
      config: fullConfig,
      live: {} as any, // Live state is managed by the client, not persisted this way.
      _initialConfigLoadComplete: true,
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
    const { config } = await request.json() as { config: ConfigState };

    if (!config) {
        return NextResponse.json({ message: 'Invalid config data provided.' }, { status: 400 });
    }

    const { tournaments, ...baseConfig } = config;

    // Create metadata for the main config file
    const tournamentMetas = tournaments.map(t => ({ id: t.id, name: t.name, status: t.status }));
    const configToSave: ConfigState = { ...baseConfig, tournaments: tournamentMetas as any };
    await writeConfig(configToSave);

    // Write each tournament to its own file
    const tournamentWritePromises = tournaments.map(t => writeTournament(t));
    await Promise.all(tournamentWritePromises);

    return NextResponse.json({ success: true, message: 'Data saved successfully.' });
  } catch (error) {
     if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred.'}, { status: 500 });
  }
}

