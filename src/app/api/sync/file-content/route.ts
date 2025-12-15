import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

// Helper function to get the storage directory from environment or default
function getStorageDir(): string {
    const storagePath = process.env.STORAGE_PATH;
    if (storagePath) {
        // Check if the path is absolute. If so, use it directly. Otherwise, join it with the current working directory.
        if (path.isAbsolute(storagePath)) {
            return storagePath;
        }
        return path.join(process.cwd(), storagePath);
    }
    // Default to './storage' in the project root if the environment variable is not set.
    return path.join(process.cwd(), 'storage');
}

// Helper function to get the data directory (where actual files are stored)
function getDataDir(): string {
    return path.join(getStorageDir(), 'data');
}

// Helper function to get the conflicts remote directory (where remote conflict files are cached)
function getConflictsRemoteDir(): string {
    return path.join(getStorageDir(), 'sync-conflicts-remote');
}

/**
 * GET endpoint to retrieve file content for conflict comparison
 * Query params:
 *   - filePath: The file path to retrieve
 *   - source: 'local' or 'remote'
 */
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const filePath = searchParams.get('filePath');
        const source = searchParams.get('source');

        if (!filePath) {
            return NextResponse.json(
                { error: 'Missing filePath parameter' },
                { status: 400 }
            );
        }

        if (source !== 'local' && source !== 'remote') {
            return NextResponse.json(
                { error: 'Invalid source parameter. Must be "local" or "remote"' },
                { status: 400 }
            );
        }

        let content: string;

        if (source === 'local') {
            // Read local file using the correct storage path (data directory)
            const dataDir = getDataDir();
            const fullPath = join(dataDir, filePath);

            console.log('[File Content API] Reading local file:', fullPath);

            try {
                const buffer = readFileSync(fullPath);
                content = buffer.toString('utf-8');
            } catch (error) {
                console.error('[File Content API] Local file read error:', error);
                return NextResponse.json(
                    { error: 'File not found locally', path: fullPath },
                    { status: 404 }
                );
            }
        } else {
            // Read remote file from cached conflict files
            // First try to read from the sync-conflicts-remote directory
            const conflictsDir = getConflictsRemoteDir();
            const cachedFilePath = join(conflictsDir, filePath);

            console.log('[File Content API] Looking for cached remote file:', cachedFilePath);

            try {
                const buffer = readFileSync(cachedFilePath);
                content = buffer.toString('utf-8');
                console.log('[File Content API] Read remote file from cache');
            } catch (cacheError) {
                console.log('[File Content API] Cached file not found, downloading from Supabase...');

                // If not in cache, download from Supabase
                try {
                    const supabase = createClient(supabaseUrl, supabaseServiceKey);
                    const bucket = process.env.SUPABASE_BUCKET || 'studio';

                    const { data, error } = await supabase.storage
                        .from(bucket)
                        .download(filePath);

                    if (error || !data) {
                        console.error('[File Content API] Supabase download error:', error);
                        return NextResponse.json(
                            { error: 'File not found in Supabase or cache' },
                            { status: 404 }
                        );
                    }

                    // Convert blob to text
                    content = await data.text();
                    console.log('[File Content API] Downloaded remote file from Supabase');
                } catch (error) {
                    console.error('[File Content API] Error downloading from Supabase:', error);
                    return NextResponse.json(
                        { error: 'Failed to download file from Supabase' },
                        { status: 500 }
                    );
                }
            }
        }

        return NextResponse.json({
            success: true,
            filePath,
            source,
            content
        });

    } catch (error) {
        console.error('[File Content API] Error:', error);
        return NextResponse.json(
            {
                error: 'Internal server error',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
