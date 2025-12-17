import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Regenerates the Supabase manifest based on files that currently exist in Supabase
 */
export async function POST() {
    try {
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

        console.log('[Regenerate Remote Manifest] Starting...');

        // Function to list all files recursively
        const listAllFiles = async (prefix: string = ''): Promise<any[]> => {
            const allFiles: any[] = [];

            console.log(`[Regenerate Remote Manifest] Listing files in: "${prefix}"`);
            const { data: items, error } = await supabase.storage
                .from(bucket)
                .list(prefix, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });

            if (error) {
                console.error(`[Regenerate Remote Manifest] Error listing "${prefix}":`, error);
                throw new Error(`Failed to list files in "${prefix}": ${error.message}`);
            }

            if (!items || items.length === 0) {
                console.log(`[Regenerate Remote Manifest] No items in "${prefix}"`);
                return allFiles;
            }

            console.log(`[Regenerate Remote Manifest] Found ${items.length} items in "${prefix}"`);

            for (const item of items) {
                const fullPath = prefix ? `${prefix}/${item.name}` : item.name;

                console.log(`[Regenerate Remote Manifest] Item: ${fullPath}, id: ${item.id}, name: ${item.name}, mimetype: ${item.metadata?.mimetype}`);

                // Skip the sync-manifest.json file itself
                if (fullPath === 'sync-manifest.json') {
                    console.log(`[Regenerate Remote Manifest] Skipping sync-manifest.json`);
                    continue;
                }

                // Check if it's a folder (id is null OR mimetype is directory)
                const isFolder = item.id === null || item.id === undefined || item.metadata?.mimetype === 'application/x-directory';

                if (isFolder) {
                    // It's a folder - recurse
                    console.log(`[Regenerate Remote Manifest] Found folder: ${fullPath}, recursing...`);
                    const subFiles = await listAllFiles(fullPath);
                    allFiles.push(...subFiles);
                    console.log(`[Regenerate Remote Manifest] Added ${subFiles.length} files from ${fullPath}`);
                } else {
                    // It's a file
                    console.log(`[Regenerate Remote Manifest] Found file: ${fullPath}`);
                    allFiles.push({
                        name: fullPath,
                        ...item
                    });
                }
            }

            console.log(`[Regenerate Remote Manifest] Returning ${allFiles.length} files from "${prefix}"`);
            return allFiles;
        };

        // Get all files
        const files = await listAllFiles();
        console.log(`[Regenerate Remote Manifest] Found ${files.length} files in Supabase`);

        // Create manifest structure
        const manifest: any = {
            version: '1.0',
            lastSync: new Date().toISOString(),
            files: {}
        };

        // Download each file and compute its hash
        for (const file of files) {
            try {
                const { data, error } = await supabase.storage
                    .from(bucket)
                    .download(file.name);

                if (error) {
                    console.error(`Error downloading ${file.name}:`, error);
                    continue;
                }

                // Compute hash
                const arrayBuffer = await data.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const hash = createHash('sha256').update(buffer).digest('hex');

                manifest.files[file.name] = {
                    hash,
                    size: file.metadata?.size || buffer.length,
                    lastModified: file.updated_at || file.created_at,
                    deleted: false
                };

                console.log(`[Regenerate Remote Manifest] Processed: ${file.name}`);
            } catch (error) {
                console.error(`Error processing ${file.name}:`, error);
            }
        }

        // Upload new manifest to Supabase
        const manifestContent = JSON.stringify(manifest, null, 2);
        const manifestBuffer = Buffer.from(manifestContent, 'utf-8');

        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload('sync-manifest.json', manifestBuffer, {
                contentType: 'application/json',
                upsert: true
            });

        if (uploadError) {
            throw new Error(`Failed to upload manifest: ${uploadError.message}`);
        }

        console.log(`[Regenerate Remote Manifest] Manifest regenerated with ${Object.keys(manifest.files).length} files`);

        return NextResponse.json({
            success: true,
            fileCount: Object.keys(manifest.files).length,
            message: `Manifest regenerado con ${Object.keys(manifest.files).length} archivo(s)`
        });
    } catch (error) {
        console.error('[Regenerate Remote Manifest] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
