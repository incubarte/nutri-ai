
import { promises as fs } from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';
import type { GameState } from '@/types';

const DB_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');

async function readDb(): Promise<GameState> {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Could not read db.json:", error);
        // This could be customized to return a default state if the file is missing/corrupt
        throw new Error("Failed to read database file.");
    }
}

async function writeDb(data: Partial<GameState>): Promise<void> {
    try {
        // Read the existing DB to merge, ensuring we don't lose data unintentionally
        const currentData = await readDb();
        
        // This simple merge replaces top-level keys. You could make this more sophisticated if needed.
        const newData = { ...currentData, ...data };

        await fs.writeFile(DB_PATH, JSON.stringify(newData, null, 2), 'utf-8');
    } catch (error) {
        console.error("Could not write to db.json:", error);
        throw new Error("Failed to write to database file.");
    }
}


export async function GET(request: Request) {
  try {
    const data = await readDb();
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown error occurred on the server.'}, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const dataToSave = await request.json() as Partial<GameState>;
    await writeDb(dataToSave);
    return NextResponse.json({ success: true, message: 'Data saved successfully.' });
  } catch (error) {
     if (error instanceof Error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'An unknown server error occurred.'}, { status: 500 });
  }
}
