import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { storageProvider } from '@/lib/storage';
import { readManifest, writeManifest, removeManifestEntry, updateManifestEntry } from '@/lib/sync-manifest';

export const dynamic = 'force-dynamic';

/**
 * POST - Revert local files to remote versions (or delete if new)
 * Used to undo local changes before syncing
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { filePaths } = body as { filePaths: string[] };

        if (!filePaths || !Array.isArray(filePaths) || filePaths.length === 0) {
            return NextResponse.json(
                { error: 'filePaths array required' },
                { status: 400 }
            );
        }

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
        const bucket = process.env.SUPABASE_BUCKET;

        if (!supabaseUrl || !supabaseKey || !bucket) {
            throw new Error('Supabase configuration missing');
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false
            }
        });

        // Read remote manifest
        const { data: manifestData, error: manifestError } = await supabase.storage
            .from(bucket)
            .download('sync-manifest.json');

        if (manifestError) {
            throw new Error(`Failed to download remote manifest: ${manifestError.message}`);
        }

        const manifestText = await manifestData.text();
        const remoteManifest = JSON.parse(manifestText);

        const results = {
            reverted: [] as string[],
            deleted: [] as string[],
            errors: [] as { filePath: string; error: string }[]
        };

        for (const filePath of filePaths) {
            try {
                // Check if file exists in remote manifest
                const remoteFileMetadata = remoteManifest.files[filePath];

                if (remoteFileMetadata && !remoteFileMetadata.deleted) {
                    // File exists remotely - download and overwrite local
                    const { data, error } = await supabase.storage
                        .from(bucket)
                        .download(filePath);

                    if (error) {
                        throw new Error(`Failed to download: ${error.message}`);
                    }

                    const content = await data.text();

                    // Write to local storage
                    await storageProvider.writeFile(filePath, content);

                    // Update local manifest to match remote
                    await updateManifestEntry(filePath, content);

                    results.reverted.push(filePath);
                    console.log(`[Revert] Reverted to remote version: ${filePath}`);

                } else {
                    // File doesn't exist remotely (it's new locally) - delete it
                    try {
                        await storageProvider.deleteFile(filePath);
                        await removeManifestEntry(filePath);

                        results.deleted.push(filePath);
                        console.log(`[Revert] Deleted new local file: ${filePath}`);
                    } catch (error) {
                        // File might not exist locally, which is fine
                        console.log(`[Revert] File already deleted or doesn't exist: ${filePath}`);
                        await removeManifestEntry(filePath);
                        results.deleted.push(filePath);
                    }
                }

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.errors.push({
                    filePath,
                    error: errorMessage
                });
                console.error(`[Revert] Failed to revert ${filePath}:`, errorMessage);
            }
        }

        return NextResponse.json({
            success: results.errors.length === 0,
            reverted: results.reverted,
            deleted: results.deleted,
            errors: results.errors,
            message: `Revertidos ${results.reverted.length} archivo(s), eliminados ${results.deleted.length} nuevo(s)${results.errors.length > 0 ? `, ${results.errors.length} fallaron` : ''}`
        });

    } catch (error) {
        console.error('[Revert] Error reverting files:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
