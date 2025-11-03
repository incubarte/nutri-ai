import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic'; // Ensure it's not cached

export async function GET(request: Request) {
    const replaysDir = path.join(process.cwd(), 'public', 'replays');

    try {
        const files = await fs.readdir(replaysDir);
        // Filter for video files and sort by name descending (newest first assuming date-based names)
        const videoFiles = files
            .filter(file => file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.ogg'))
            .sort((a, b) => b.localeCompare(a)); 

        return NextResponse.json({ success: true, files: videoFiles });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            // Directory doesn't exist, which is a valid state (no replays saved yet)
            return NextResponse.json({ success: true, files: [] });
        }
        console.error("[API/REPLAYS] Error reading replays directory:", error);
        return NextResponse.json({ success: false, message: "Error al leer las repeticiones." }, { status: 500 });
    }
}
