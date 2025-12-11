import { NextResponse } from 'next/server';
import { storageProvider } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/**
 * Read a file from local storage
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const path = searchParams.get('path');

        if (!path) {
            return NextResponse.json(
                { error: 'Path parameter is required' },
                { status: 400 }
            );
        }

        // Try to read the file
        let content: Buffer;
        try {
            content = await storageProvider.readBinaryFile(path);
        } catch (readError) {
            // File doesn't exist or can't be read
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        // Determine content type based on file extension
        const ext = path.split('.').pop()?.toLowerCase();
        const contentTypeMap: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'json': 'application/json',
            'txt': 'text/plain',
        };

        const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';

        // Convert Buffer to Uint8Array for NextResponse compatibility
        const uint8Array = new Uint8Array(content);

        // Return the file content
        return new NextResponse(uint8Array, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            },
        });

    } catch (error) {
        console.error('[Storage Read API] Error:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}
