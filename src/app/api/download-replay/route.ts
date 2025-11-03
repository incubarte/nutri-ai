import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
    try {
        const { url, date } = await request.json();

        if (!url) {
            return NextResponse.json({ message: 'URL del video es requerida.' }, { status: 400 });
        }

        const videoResponse = await fetch(url);

        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
        }

        const videoBuffer = await videoResponse.arrayBuffer();

        // Use the date to create a subfolder, or use the base replays folder if no date is provided
        const baseDir = path.join(process.cwd(), 'public', 'replays');
        const targetDir = date ? path.join(baseDir, date) : baseDir;
        await fs.mkdir(targetDir, { recursive: true });
        
        // Use the original filename from the URL if possible, otherwise generate one
        const urlPath = new URL(url).pathname;
        let filename = decodeURIComponent(urlPath.split('/').pop() || `replay-${Date.now()}.mp4`);
        // A further cleanup to handle potential query params in filename segment
        filename = filename.split('?')[0];

        const filePath = path.join(targetDir, filename);
        const publicPath = date ? `/replays/${date}/${filename}` : `/replays/${filename}`;

        // Guarda el archivo
        await fs.writeFile(filePath, Buffer.from(videoBuffer));

        return NextResponse.json({ success: true, path: publicPath });

    } catch (error) {
        console.error('[API/DOWNLOAD-REPLAY] Error:', error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor.";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
