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
        
        const baseDir = path.join(process.cwd(), 'public', 'replays');
        
        // Use the provided date to create a specific subfolder.
        // If no date is provided, it saves to the root of 'replays'.
        const targetDir = date ? path.join(baseDir, date) : baseDir;
        await fs.mkdir(targetDir, { recursive: true });
        
        // Extract only the filename from the URL, ignoring any path.
        const urlPath = new URL(url).pathname;
        let filename = decodeURIComponent(urlPath.split('/').pop() || `replay-${Date.now()}.mp4`);
        // A further cleanup to handle potential query params in filename segment
        filename = filename.split('?')[0];

        const filePath = path.join(targetDir, filename);
        // The public path needs to reflect the folder structure we just created.
        const publicPath = date ? `/replays/${date}/${filename}` : `/replays/${filename}`;

        // Save the file to the determined path.
        await fs.writeFile(filePath, Buffer.from(videoBuffer));

        return NextResponse.json({ success: true, path: publicPath });

    } catch (error) {
        console.error('[API/DOWNLOAD-REPLAY] Error:', error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor.";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}
