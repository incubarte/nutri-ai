import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * Fetches the content of a file from Supabase storage
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filePath = searchParams.get('filePath');

        if (!filePath) {
            return NextResponse.json({
                success: false,
                error: 'Missing filePath parameter'
            }, { status: 400 });
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
        const bucket = process.env.SUPABASE_BUCKET || 'scoreboard-data';

        if (!supabaseUrl || !supabaseKey) {
            return NextResponse.json({
                success: false,
                error: 'Supabase configuration missing'
            }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

        // Download the file
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(filePath);

        if (error) {
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 404 });
        }

        // Read content as text
        const content = await data.text();

        return NextResponse.json({
            success: true,
            content
        });
    } catch (error) {
        console.error('[Remote File Content] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
