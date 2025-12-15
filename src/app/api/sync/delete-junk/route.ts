import { NextResponse } from 'next/server';
import { storageProvider } from '@/lib/storage';
import { readManifest, writeManifest } from '@/lib/sync-manifest';

export const dynamic = 'force-dynamic';

/**
 * Deletes junk files from local storage
 */
export async function POST(request: Request) {
    try {
        const { filePaths } = await request.json();

        if (!filePaths || !Array.isArray(filePaths)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid filePaths parameter'
            }, { status: 400 });
        }

        console.log(`[Delete Junk] Deleting ${filePaths.length} files...`);

        const deleted: string[] = [];
        const errors: { filePath: string; error: string }[] = [];

        // Read manifest
        const manifest = await readManifest();

        // Delete each file
        for (const filePath of filePaths) {
            try {
                // Delete the actual file
                await storageProvider.deleteFile(filePath);
                console.log(`[Delete Junk] Deleted: ${filePath}`);

                // Remove from manifest
                delete manifest.files[filePath];

                deleted.push(filePath);
            } catch (error) {
                console.error(`[Delete Junk] Error deleting ${filePath}:`, error);
                errors.push({
                    filePath,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        // Update manifest
        await writeManifest(manifest);

        return NextResponse.json({
            success: true,
            deleted,
            errors,
            message: `Deleted ${deleted.length} file(s)${errors.length > 0 ? `, ${errors.length} failed` : ''}`
        });
    } catch (error) {
        console.error('[Delete Junk] Error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
