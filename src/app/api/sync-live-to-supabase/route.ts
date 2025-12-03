import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';

// Helper to get storage directory
function getStorageDir(): string {
    const storagePath = process.env.STORAGE_PATH;
    if (storagePath) {
        if (path.isAbsolute(storagePath)) {
            return storagePath;
        }
        return path.join(process.cwd(), storagePath);
    }
    return path.join(process.cwd(), 'storage');
}

export async function POST() {
    try {
        const storageMode = process.env.STORAGE_PROVIDER || 'local';

        // Only allow this operation in local mode (to upload TO Supabase FROM local)
        if (storageMode.startsWith('supabase_')) {
            return NextResponse.json(
                { error: 'Esta operación solo está disponible en modo local (para subir a Supabase)' },
                { status: 400 }
            );
        }

        // Get Supabase configuration - use SERVICE_KEY for full access
        const supabaseUrl = process.env.SUPABASE_URL;
        const bucket = process.env.SUPABASE_BUCKET;
        const serviceKey = process.env.SUPABASE_SERVICE_KEY;

        if (!supabaseUrl || !bucket || !serviceKey) {
            console.log('[LIVE-SYNC] Supabase not configured, skipping sync');
            return NextResponse.json({
                success: false,
                message: 'Supabase no configurado'
            });
        }

        // Create Supabase client using SERVICE_KEY for full access
        const supabase = createClient(supabaseUrl, serviceKey);

        // Read local live.json file
        const localStorageDir = path.join(getStorageDir(), 'data');
        const liveFilePath = path.join(localStorageDir, 'live.json');

        let liveContent: string;
        try {
            liveContent = await fs.readFile(liveFilePath, 'utf-8');
        } catch (err) {
            console.log('[LIVE-SYNC] live.json not found locally, skipping sync');
            return NextResponse.json({
                success: false,
                message: 'Archivo live.json no encontrado localmente'
            });
        }

        // Upload to Supabase
        const { error } = await supabase.storage
            .from(bucket)
            .upload('live.json', liveContent, {
                contentType: 'application/json',
                upsert: true, // Overwrite if exists
            });

        if (error) {
            console.error('[LIVE-SYNC] Error uploading to Supabase:', error);
            return NextResponse.json({
                success: false,
                message: 'Error al subir a Supabase',
                error: error.message
            }, { status: 500 });
        }

        console.log('[LIVE-SYNC] Successfully uploaded live.json to Supabase');
        return NextResponse.json({
            success: true,
            message: 'live.json sincronizado a Supabase'
        });

    } catch (error) {
        console.error('[LIVE-SYNC] Error syncing live.json to Supabase:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Error al sincronizar live.json a Supabase',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
