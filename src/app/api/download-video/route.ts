
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ message: 'URL del video es requerida.' }, { status: 400 });
        }

        // Fetch the video from the provided URL on the server-side
        const videoResponse = await fetch(url);

        if (!videoResponse.ok) {
            throw new Error(`Failed to fetch video from URL: ${videoResponse.status} ${videoResponse.statusText}`);
        }

        // Get the video data as a Blob
        const videoBlob = await videoResponse.blob();
        
        // Stream the blob back to the client
        return new NextResponse(videoBlob, {
            status: 200,
            headers: {
                'Content-Type': videoBlob.type,
            },
        });

    } catch (error) {
        console.error('[API/DOWNLOAD-VIDEO] Error:', error);
        const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor.";
        return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
}

    