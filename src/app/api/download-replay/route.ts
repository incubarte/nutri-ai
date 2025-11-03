import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ message: 'URL del video es requerida.' }, { status: 400 });
        }

        const videoResponse = await fetch(url);

        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`);
        }

        const videoBuffer = await videoResponse.arrayBuffer();

        // Define el directorio y el nombre del archivo
        const replaysDir = path.join(process.cwd(), 'public', 'replays');
        await fs.mkdir(replaysDir, { recursive: true });
        
        const filename = `replay-${Date.now()}.mp4`;
        const filePath = path.join(replaysDir, filename);
        const publicPath = `/replays/${filename}`;

        // Guarda el archivo
        await fs.writeFile(filePath, Buffer.from(videoBuffer));

        return NextResponse.json({ success: true, path: publicPath });

    } catch (error) {
        console.error('[API/DOWNLOAD-REPLAY] Error:', error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor.";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
