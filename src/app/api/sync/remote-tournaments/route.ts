import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Loads tournaments from Supabase with their teams data
 */
export async function GET() {
    try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                success: false,
                error: 'Supabase configuration missing'
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Load tournaments.json
        const { data: tournamentsFile, error: tournamentsError } = await supabase.storage
            .from('scoreboard-data')
            .download('tournaments.json');

        if (tournamentsError) {
            return NextResponse.json({
                success: false,
                error: 'tournaments.json not found in Supabase'
            }, { status: 404 });
        }

        const tournamentsContent = await tournamentsFile.text();
        const tournamentsData = JSON.parse(tournamentsContent);
        const tournaments = tournamentsData?.tournaments || [];

        // Load teams.json for each tournament
        for (const tournament of tournaments) {
            try {
                const { data: teamsFile } = await supabase.storage
                    .from('scoreboard-data')
                    .download(`tournaments/${tournament.id}/teams.json`);

                if (teamsFile) {
                    const teamsContent = await teamsFile.text();
                    const teamsData = JSON.parse(teamsContent);
                    tournament.teams = teamsData.teams || [];
                }
            } catch (error) {
                console.log(`No teams.json for tournament ${tournament.id}`);
                tournament.teams = [];
            }
        }

        return NextResponse.json({
            success: true,
            tournaments
        });
    } catch (error) {
        console.error('[Remote Tournaments] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
