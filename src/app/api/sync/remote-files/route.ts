import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface RemoteFile {
    name: string;
    id: string;
    updated_at: string;
    created_at: string;
    last_accessed_at: string;
    metadata: {
        size: number;
        mimetype: string;
        cacheControl: string;
    };
}

/**
 * GET - List all files in remote Supabase storage
 */
export async function GET() {
    try {
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

        // List all files recursively
        const files: RemoteFile[] = [];
        const listFilesRecursively = async (path: string = '') => {
            const { data, error } = await supabase.storage
                .from(bucket)
                .list(path, {
                    limit: 1000,
                    sortBy: { column: 'name', order: 'asc' }
                });

            if (error) throw error;

            for (const item of data || []) {
                const fullPath = path ? `${path}/${item.name}` : item.name;

                // If it's a folder, recurse
                if (item.id === null) {
                    await listFilesRecursively(fullPath);
                } else {
                    // It's a file
                    files.push({
                        name: fullPath,
                        id: item.id,
                        updated_at: item.updated_at || '',
                        created_at: item.created_at || '',
                        last_accessed_at: item.last_accessed_at || '',
                        metadata: item.metadata as any
                    });
                }
            }
        };

        await listFilesRecursively();

        return NextResponse.json({
            success: true,
            files: files.filter(f => f.name !== 'sync-manifest.json'), // Exclude manifest
            totalFiles: files.length - 1 // -1 for manifest
        });

    } catch (error) {
        console.error('[Remote Files] Error listing files:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE - Delete files from Supabase and mark as deleted in manifest
 */
export async function DELETE(request: Request) {
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

        // Download current remote manifest
        const { data: manifestData, error: manifestError } = await supabase.storage
            .from(bucket)
            .download('sync-manifest.json');

        if (manifestError) {
            throw new Error(`Failed to download manifest: ${manifestError.message}`);
        }

        const manifestText = await manifestData.text();
        const manifest = JSON.parse(manifestText);

        const results = {
            deleted: [] as string[],
            errors: [] as { filePath: string; error: string }[]
        };

        // Delete each file and track deletion in manifest
        for (const filePath of filePaths) {
            try {
                // Get the file's hash before deleting (if it exists in manifest)
                const fileMetadata = manifest.files[filePath];
                const fileHash = fileMetadata?.hash;

                // Delete from storage
                const { error: deleteError } = await supabase.storage
                    .from(bucket)
                    .remove([filePath]);

                if (deleteError) {
                    throw deleteError;
                }

                // Mark as deleted in manifest (keep the entry with deleted flag)
                if (manifest.files[filePath]) {
                    manifest.files[filePath] = {
                        ...manifest.files[filePath],
                        deleted: true,
                        deletedAt: new Date().toISOString(),
                        deletedHash: fileHash // Store hash at deletion time
                    };
                } else {
                    // File wasn't in manifest, add deletion marker
                    manifest.files[filePath] = {
                        deleted: true,
                        deletedAt: new Date().toISOString(),
                        hash: 'unknown',
                        deletedHash: 'unknown',
                        lastModified: new Date().toISOString()
                    };
                }

                results.deleted.push(filePath);
                console.log(`[Remote Files] Deleted: ${filePath}`);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.errors.push({
                    filePath,
                    error: errorMessage
                });
                console.error(`[Remote Files] Failed to delete ${filePath}:`, errorMessage);
            }
        }

        // Upload updated manifest
        manifest.lastSync = new Date().toISOString();
        const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload('sync-manifest.json', JSON.stringify(manifest, null, 2), {
                upsert: true,
                contentType: 'application/json'
            });

        if (uploadError) {
            throw new Error(`Failed to upload updated manifest: ${uploadError.message}`);
        }

        console.log(`[Remote Files] Updated manifest with ${results.deleted.length} deletions`);

        return NextResponse.json({
            success: results.errors.length === 0,
            deleted: results.deleted,
            errors: results.errors,
            message: `Deleted ${results.deleted.length} file(s)${results.errors.length > 0 ? `, ${results.errors.length} failed` : ''}`
        });

    } catch (error) {
        console.error('[Remote Files] Error deleting files:', error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
