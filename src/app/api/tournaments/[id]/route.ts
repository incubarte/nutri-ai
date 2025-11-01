import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import type { Tournament, TeamData, CategoryData, MatchData, PeriodSummary } from '@/types';

const TOURNAMENTS_DIR = path.join(process.cwd(), 'src/data/tournaments');

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
    const summariesDir = path.join(tournamentDir, 'summaries');

    try {
        await fs.access(tournamentDir); // Check if directory exists

        const [teamsData, fixtureData] = await Promise.all([
            readData(teamsFilePath),
            readData(fixtureFilePath)
        ]);

        if (fixtureData && fixtureData.matches) {
            const matchSummaryPromises = fixtureData.matches.map(async (match: MatchData) => {
                const summaryPath = path.join(summariesDir, `${match.id}.json`);
                try {
                    const summary = await readData(summaryPath);
                    return { ...match, summary: summary || undefined };
                } catch {
                    return match; // Return match without summary if file not found
                }
            });
            fixtureData.matches = await Promise.all(matchSummaryPromises);
        }
        
        return {
            ...(teamsData || {}),
            ...(fixtureData || {}),
        };
    } catch (error) {
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
    const summariesDir = path.join(tournamentDir, 'summaries');

    try {
        await fs.mkdir(summariesDir, { recursive: true });

        const teamsData = {
            categories: tournament.categories || [],
            teams: tournament.teams || [],
        };
        
        const fixtureMatches: MatchData[] = [];
        const summaryWritePromises: Promise<void>[] = [];

        (tournament.matches || []).forEach(match => {
            const { summary, ...matchWithoutSummary } = match;
            
            if (summary) {
                const summaryPath = path.join(summariesDir, `${match.id}.json`);
                summaryWritePromises.push(writeData(summaryPath, summary));
                
                const homeScore = (summary.statsByPeriod ?? []).reduce((acc: number, p: PeriodSummary) => acc + (p.stats.goals?.home?.length ?? 0), 0);
                const awayScore = (summary.statsByPeriod ?? []).reduce((acc: number, p: PeriodSummary) => acc + (p.stats.goals?.away?.length ?? 0), 0);

                
                matchWithoutSummary.homeScore = homeScore;
                matchWithoutSummary.awayScore = awayScore;

                const wentToOTOrSO = (summary.playedPeriods || []).some(p => p.startsWith('OT')) || (summary.shootout && (summary.shootout.homeAttempts.length > 0 || summary.shootout.awayAttempts.length > 0));

                matchWithoutSummary.overTimeOrShootouts = wentToOTOrSO;
            }
            fixtureMatches.push(matchWithoutSummary);
        });

        const fixtureData = {
            matches: fixtureMatches,
        };

        await Promise.all([
            writeData(teamsFilePath, teamsData),
            writeData(fixtureFilePath, fixtureData),
            ...summaryWritePromises,
        ]);

    } catch (error) {
         console.error(`Could not write to tournament files for ${tournament.id}:`, error);
        throw new Error("Failed to write tournament file.");
    }
}


export async function GET(request: Request, { params }: { params: { id: string } }) {
    const tournamentId = params.id;
    try {
        const tournamentDetails = await readTournament(tournamentId);

        if (!tournamentDetails) {
            return NextResponse.json({ message: "Tournament not found" }, { status: 404 });
        }

        const config = await readData(CONFIG_PATH);
        const tournamentMeta = (config?.tournaments || []).find((t: any) => t.id === tournamentId);
        
        const fullTournament = {
            ...tournamentMeta,
            ...tournamentDetails,
        };
        
        return NextResponse.json({ tournament: fullTournament });
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown server error occurred.' }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
    const tournamentId = params.id;
    try {
        const { tournament } = await request.json() as { tournament: Tournament };

        if (!tournament || tournament.id !== tournamentId) {
            return NextResponse.json({ message: 'Invalid tournament data provided.' }, { status: 400 });
        }
        
        await writeTournament(tournament);

        return NextResponse.json({ success: true, message: `Tournament ${tournamentId} saved successfully.` });
    } catch (error) {
        if (error instanceof Error) {
            return NextResponse.json({ message: error.message }, { status: 500 });
        }
        return NextResponse.json({ message: 'An unknown server error occurred.' }, { status: 500 });
    }
}
