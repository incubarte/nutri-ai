import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getStorageDir } from '@/lib/storage/local-provider';

export const dynamic = 'force-dynamic'; // Ensure it's not cached

// Recursive function to get all video files from a directory and its subdirectories
async function getVideoFiles(dir: string, baseDir: string = dir): Promise<string[]> {
    let files: string[] = [];
    try {
        const dirents = await fs.readdir(dir, { withFileTypes: true });
        for (const dirent of dirents) {
            const res = path.resolve(dir, dirent.name);
            if (dirent.isDirectory()) {
                files = files.concat(await getVideoFiles(res, baseDir));
            } else if (dirent.name.endsWith('.mp4') || dirent.name.endsWith('.webm') || dirent.name.endsWith('.ogg')) {
                // Return path relative to the base 'replays' directory
                files.push(path.relative(baseDir, res).replace(/\\/g, '/'));
            }
        }
    } catch (error: any) {
         if (error.code !== 'ENOENT') {
            throw error;
         }
    }
    return files;
}

export async function GET(request: Request) {
    const storageDir = getStorageDir();
    const replaysDir = path.join(storageDir, 'replays');

    try {
        const videoFiles = await getVideoFiles(replaysDir);
        videoFiles.sort((a, b) => b.localeCompare(a)); 

        return NextResponse.json({ success: true, files: videoFiles });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // If the replays directory doesn't exist, it's not an error, just return an empty list.
            return NextResponse.json({ success: true, files: [] });
        }
        console.error("[API/REPLAYS] Error reading replays directory:", error);
        return NextResponse.json({ success: false, message: "Error al leer las repeticiones." }, { status: 500 });
    }
}
