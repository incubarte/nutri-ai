
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import type { GameState, ConfigState, Tournament, TeamData, CategoryData, MatchData, LiveState } from '@/types';

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


async function readTournament(tournamentId: string): Promise<Partial<Tournament> | null> {
    const tournamentDir = path.join(TOURNAMENTS_DIR, tournamentId);
    const teamsFilePath = path.join(tournamentDir, 'teams.json');
    const fixtureFilePath = path.join(tournamentDir, 'fixture.json');

    try {
        await fs.access(tournamentDir); // Check if directory exists

        const teamsData: { categories: CategoryData[], teams: TeamData[] } = await readData(teamsFilePath);
        const fixtureData: { matches: MatchData[] } = await readData(fixtureFilePath);
        
        return {
            ...(teamsData || {}),
            ...(fixtureData || {}),
        };
    } catch (error) {
        // If directory or files don't exist, it's okay, just return null.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        console.error(`Error reading tournament ${tournamentId}:`, error);
        return null;
    }
}

async function writeTournament(tournament: Tournament): Promise<void> {
    const tournamentDir = path.join(TOURNAMENTS_DIR, tournament.id);
    const teamsFilePath = path.join(tournamentDir, 'teams.json');
    const fixtureFilePath = path.join(tournamentDir, 'fixture.json');

    try {
        const teamsData = {
            categories: tournament.categories || [],
            teams: tournament.teams || [],
        };
        const fixtureData = {
            matches: tournament.matches || [],
        };

        await writeData(teamsFilePath, teamsData);
        await writeData(fixtureFilePath, fixtureData);

    } catch (error) {
         console.error(`Could not write to tournament files for ${tournament.id}:`, error);
        throw new Error("Failed to write tournament file.");
    }
}


export async function GET(request: Request) {
  try {
    const [config, liveState] = await Promise.all([
        readData(CONFIG_PATH),
        readData(LIVE_STATE_PATH)
    ]);
    
    const fullConfig = config || {};
    if (!fullConfig.tournaments) {
        fullConfig.tournaments = [];
    }

    const tournamentPromises = fullConfig.tournaments.map(async (meta: any) => {
        const tournamentDetails = await readTournament(meta.id);
        return {
            ...meta,
            ...(tournamentDetails || { teams: [], categories: [], matches: [] }),
        };
    });

    const fullTournaments = await Promise.all(tournamentPromises);
    
    fullConfig.tournaments = fullTournaments;
    
    const initialState: GameState = {
      config: fullConfig,
      live: liveState || {}, 
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
    const { config, live } = await request.json() as { config: ConfigState; live?: LiveState };

    if (config) {
        const { tournaments, ...baseConfig } = config;
        const tournamentMetas = tournaments.map(t => ({ id: t.id, name: t.name, status: t.status }));
        const configToSave: Partial<ConfigState> = { ...baseConfig, tournaments: tournamentMetas as any };
        
        await writeData(CONFIG_PATH, configToSave);

        if (tournaments) {
            const tournamentWritePromises = tournaments.map(t => writeTournament(t));
            await Promise.all(tournamentWritePromises);
        }
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
