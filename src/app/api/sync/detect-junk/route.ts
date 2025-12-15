import { NextResponse } from 'next/server';
import { readManifest } from '@/lib/sync-manifest';
import { readTournaments } from '@/lib/data-access';
import { storageProvider } from '@/lib/storage';
import path from 'path';

export const dynamic = 'force-dynamic';

/**
 * Detects junk files (unreferenced summaries and player photos)
 */
export async function GET() {
    try {
        console.log('[Detect Junk] Starting detection...');

        // 1. Read local manifest
        const manifest = await readManifest();
        console.log('[Detect Junk] Local manifest loaded:', Object.keys(manifest.files).length, 'files');

        // 2. Load tournaments data with matches
        const tournamentsData = await readTournaments();
        const tournaments: any[] = tournamentsData?.tournaments || [];
        console.log(`[Detect Junk] Loaded ${tournaments.length} tournaments`);

        // 3. Load fixture.json for each tournament to get matches
        for (const tournament of tournaments) {
            try {
                const fixturePath = path.join('tournaments', tournament.id, 'fixture.json');
                const fixtureContent = await storageProvider.readFile(fixturePath);
                const fixture = JSON.parse(fixtureContent);
                tournament.matches = fixture.matches || [];
                console.log(`[Detect Junk] Loaded ${tournament.matches.length} matches for tournament ${tournament.id}`);
            } catch (error) {
                console.log(`[Detect Junk] No fixture.json for tournament ${tournament.id}`);
                tournament.matches = [];
            }

            // Load teams.json for each tournament
            try {
                const teamsPath = path.join('tournaments', tournament.id, 'teams.json');
                const teamsContent = await storageProvider.readFile(teamsPath);
                const teamsData = JSON.parse(teamsContent);
                tournament.teams = teamsData.teams || [];
                console.log(`[Detect Junk] Loaded ${tournament.teams.length} teams for tournament ${tournament.id}`);
            } catch (error) {
                console.log(`[Detect Junk] No teams.json for tournament ${tournament.id}`);
                tournament.teams = [];
            }
        }

        // 3. Helper functions
        const extractMatchInfo = (filePath: string) => {
            const summaryMatch = filePath.match(/tournaments\/([^/]+)\/summaries\/([^/]+)\.json/);
            if (!summaryMatch) return null;

            const [, tournamentId, matchId] = summaryMatch;

            // Find the tournament
            let tournament = tournaments.find((t: any) => t.id === tournamentId);

            // If tournament not found, search all tournaments for the match
            if (!tournament) {
                for (const t of tournaments) {
                    if (t.matches?.find((m: any) => m.id === matchId)) {
                        tournament = t;
                        break;
                    }
                }
            }

            // If still no tournament or tournament doesn't have matches loaded
            if (!tournament || !tournament.matches || tournament.matches.length === 0) {
                const tournamentExists = tournaments.find((t: any) => t.id === tournamentId);
                if (tournamentExists) {
                    return { isOutsideFixture: true, tournamentId, matchId };
                }
                return null;
            }

            // Find the match
            const match = tournament.matches.find((m: any) => m.id === matchId);
            if (!match) {
                return { isOutsideFixture: true, tournamentId, matchId };
            }

            return { isOutsideFixture: false, tournamentId, matchId };
        };

        const extractPlayerPhotoInfo = (filePath: string) => {
            // Match pattern: tournaments/{tournamentId}/players/{teamSlug}/{photoFileName}
            const photoMatch = filePath.match(/tournaments\/([^/]+)\/players\/([^/]+)\/([^/]+\.(png|jpg|jpeg|webp))$/i);
            if (!photoMatch) return null;

            const [, tournamentId, teamSlug, photoFileName] = photoMatch;
            const tournament = tournaments.find((t: any) => t.id === tournamentId);

            if (!tournament || !tournament.teams) {
                return { isUnreferenced: true, tournamentId, teamSlug, photoFileName };
            }

            // Check if any team references this player photo by photoFileName
            const isReferenced = tournament.teams.some((team: any) =>
                team.players?.some((player: any) => player.photoFileName === photoFileName)
            );

            return { isUnreferenced: !isReferenced, tournamentId, teamSlug, photoFileName };
        };

        // 4. Detect junk files
        const summariesOutsideFixture: string[] = [];
        const unreferencedPhotos: string[] = [];

        for (const filePath of Object.keys(manifest.files)) {
            // Skip deleted files
            if (manifest.files[filePath].deleted) continue;

            // Check if it's a summary outside fixture
            const matchInfo = extractMatchInfo(filePath);
            if (matchInfo?.isOutsideFixture) {
                summariesOutsideFixture.push(filePath);
            }

            // Check if it's an unreferenced photo
            const photoInfo = extractPlayerPhotoInfo(filePath);
            if (photoInfo?.isUnreferenced) {
                unreferencedPhotos.push(filePath);
            }
        }

        console.log(`[Detect Junk] Found ${summariesOutsideFixture.length} summaries outside fixture`);
        console.log(`[Detect Junk] Found ${unreferencedPhotos.length} unreferenced photos`);

        return NextResponse.json({
            success: true,
            junkFiles: {
                summariesOutsideFixture,
                unreferencedPhotos,
                total: summariesOutsideFixture.length + unreferencedPhotos.length
            }
        });
    } catch (error) {
        console.error('[Detect Junk] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
