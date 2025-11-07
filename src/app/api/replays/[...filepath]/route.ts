import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getStorageDir } from '@/lib/storage/local-provider';

export async function GET(
  request: Request,
  { params }: { params: { filepath: string[] } }
) {
  try {
    const storageDir = getStorageDir();
    const replaysBaseDir = path.join(storageDir, 'replays');
    
    // Reconstruct the file path from the URL segments
    const relativePath = params.filepath.join('/');
    const filePath = path.join(replaysBaseDir, relativePath);

    // Security check: Ensure the path is within the replays directory
    const resolvedPath = path.resolve(filePath);
    const resolvedBaseDir = path.resolve(replaysBaseDir);
    if (!resolvedPath.startsWith(resolvedBaseDir)) {
      return NextResponse.json({ message: 'Acceso denegado.' }, { status: 403 });
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ message: 'Video no encontrado.' }, { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);
    
    // The 'content-type' is important for the browser to render the video correctly.
    // 'Content-Length' is also crucial for seeking and progress bars.
    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stat.size.toString(),
        'Accept-Ranges': 'bytes', // Allows seeking in the video player
      },
    });

  } catch (error) {
    console.error('[API/REPLAY-STREAM] Error:', error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido en el servidor.";
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  }
}
