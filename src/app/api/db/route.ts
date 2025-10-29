
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import type { GameState, ConfigState, Tournament, TeamData, CategoryData, MatchData } from '@/types';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const TOURNAMENTS_DIR = path.join(DATA_DIR, 'tournaments');

async function readConfig(): Promise<ConfigState> {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            // Config file doesn't exist, return a default structure
            return {
                formatAndTimingsProfiles: [],
                selectedFormatAndTimingsProfileId: null,
                scoreboardLayout: {} as any, 
                scoreboardLayoutProfiles: [],
                selectedScoreboardLayoutProfileId: null,
                tournaments: [],
                selectedTournamentId: null,
                selectedMatchCategory: '',
                // Add other required fields from ConfigState with default values
            } as ConfigState;
        }
        console.error("Could not read config.json:", error);
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

async function readTournament(tournamentId: string): Promise<Partial<Tournament> | null> {
    const tournamentDir = path.join(TOURNAMENTS_DIR, tournamentId);
    const teamsFilePath = path.join(tournamentDir, 'teams.json');
    const fixtureFilePath = path.join(tournamentDir, 'fixture.json');

    try {
        await fs.access(tournamentDir); // Check if directory exists

        const teamsData: { categories: CategoryData[], teams: TeamData[] } = JSON.parse(await fs.readFile(teamsFilePath, 'utf-8'));
        const fixtureData: { matches: MatchData[] } = JSON.parse(await fs.readFile(fixtureFilePath, 'utf-8'));
        
        return {
            ...teamsData,
            ...fixtureData,
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
        await fs.mkdir(tournamentDir, { recursive: true });

        const teamsData = {
            categories: tournament.categories || [],
            teams: tournament.teams || [],
        };
        const fixtureData = {
            matches: tournament.matches || [],
        };

        await fs.writeFile(teamsFilePath, JSON.stringify(teamsData, null, 2), 'utf-8');
        await fs.writeFile(fixtureFilePath, JSON.stringify(fixtureData, null, 2), 'utf-8');

    } catch (error) {
         console.error(`Could not write to tournament files for ${tournament.id}:`, error);
        throw new Error("Failed to write tournament file.");
    }
}


export async function GET(request: Request) {
  try {
    const config = await readConfig();
    
    if (!config.tournaments) {
        config.tournaments = [];
    }

    const tournamentPromises = config.tournaments.map(async (meta) => {
        const tournamentDetails = await readTournament(meta.id);
        return {
            ...meta,
            ...(tournamentDetails || { teams: [], categories: [], matches: [] }),
        };
    });

    const fullTournaments = await Promise.all(tournamentPromises);
    
    const fullConfig: ConfigState = {
        ...config,
        tournaments: fullTournaments,
    };
    
    const initialState: GameState = {
      config: fullConfig,
      live: {} as any, 
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

    const tournamentMetas = tournaments.map(t => ({ id: t.id, name: t.name, status: t.status }));
    const configToSave: ConfigState = { ...baseConfig, tournaments: tournamentMetas as any };
    await writeConfig(configToSave);

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
