import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
    try {
        const { url, date, filename: providedFilename } = await request.json();

        if (!url) {
            return NextResponse.json({ message: 'URL del video es requerida.' }, { status: 400 });
        }

        const videoResponse = await fetch(url);

        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
        }

        const videoBuffer = await videoResponse.arrayBuffer();
        
        const baseDir = path.join(process.cwd(), 'public', 'replays');
        
        const targetDir = date ? path.join(baseDir, date) : baseDir;
        await fs.mkdir(targetDir, { recursive: true });
        
        // Use the provided filename, or fallback to extracting it from the URL
        const filename = providedFilename || decodeURIComponent(new URL(url).pathname.split('/').pop()?.split('?')[0] || `replay-${Date.now()}.mp4`);

        const filePath = path.join(targetDir, filename);
        
        const publicPath = date ? `/replays/${date}/${filename}` : `/replays/${filename}`;

        await fs.writeFile(filePath, Buffer.from(videoBuffer));

        return NextResponse.json({ success: true, path: publicPath });

    } catch (error) {
        console.error('[API/DOWNLOAD-REPLAY] Error:', error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor.";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
