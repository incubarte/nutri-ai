import { NextResponse } from 'next/server';
import { storageProvider } from '@/lib/storage';
import { removeManifestEntry } from '@/lib/sync-manifest';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Upload a player photo
 */
export async function POST(request: Request) {
    try {
        console.log('[API] Player photo upload request received');
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const tournamentId = formData.get('tournamentId') as string;
        const teamName = formData.get('teamName') as string;
        const playerName = formData.get('playerName') as string;

        console.log('[API] Form data:', {
            hasFile: !!file,
            fileName: file?.name,
            fileSize: file?.size,
            fileType: file?.type,
            tournamentId,
            teamName,
            playerName
        });

        if (!file || !tournamentId || !teamName || !playerName) {
            console.error('[API] Missing required fields');
            return NextResponse.json(
                { error: 'Missing required fields: file, tournamentId, teamName, or playerName' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
            console.error('[API] Invalid file type:', file.type);
            return NextResponse.json(
                { error: 'File must be an image' },
                { status: 400 }
            );
        }

        // Generate filename: playerName_hash.png
        const sanitizedPlayerName = playerName
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');

        const hash = crypto.randomBytes(2).toString('hex'); // 4 character hash
        const extension = file.name.split('.').pop() || 'png';
        const fileName = `${sanitizedPlayerName}_${hash}.${extension}`;

        // Sanitize team name for folder
        const sanitizedTeamName = teamName
            .toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');

        // Path: tournaments/{tournamentId}/players/{teamName}/{fileName}
        const filePath = `tournaments/${tournamentId}/players/${sanitizedTeamName}/${fileName}`;

        console.log('[API] Generated file path:', filePath);

        // Convert file to buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log('[API] File converted to buffer, size:', buffer.length);

        // Save file using storage provider (works for both local and Supabase)
        try {
            await storageProvider.writeBinaryFile(filePath, buffer, file.type);
            console.log('[API] ✅ File written successfully using storage provider');
        } catch (writeError) {
            console.error('[API] ❌ Failed to write file:', writeError);
            throw writeError;
        }

        return NextResponse.json({
            success: true,
            fileName,
            filePath
        });

    } catch (error) {
        console.error('[Player Photo Upload API] Error:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * Delete a player photo
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const filePath = searchParams.get('path');

        if (!filePath) {
            return NextResponse.json(
                { error: 'Path parameter is required' },
                { status: 400 }
            );
        }

        // Validate path starts with tournaments/
        if (!filePath.startsWith('tournaments/')) {
            return NextResponse.json(
                { error: 'Invalid path' },
                { status: 400 }
            );
        }

        await storageProvider.deleteFile(filePath);

        // Remove from manifest for sync
        try {
            await removeManifestEntry(filePath);
            console.log('[API] ✅ Removed from manifest:', filePath);
        } catch (manifestError) {
            console.error('[API] ⚠️  Failed to remove from manifest (non-fatal):', manifestError);
            // Don't fail the request if manifest update fails
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('[Player Photo Delete API] Error:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
