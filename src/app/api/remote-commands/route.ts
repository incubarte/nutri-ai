
import { sendCommand } from '@/lib/server-side-store';
import { NextResponse } from 'next/server';
import type { RemoteCommand } from '@/types';

export async function POST(request: Request) {
  try {
    const commandData = (await request.json()) as RemoteCommand;
    if (!commandData || !commandData.type) {
      return NextResponse.json({ message: 'Invalid command data provided.' }, { status: 400 });
    }
    
    // Broadcast the command to any listening /controls pages
    sendCommand(commandData);
    
    return NextResponse.json({ success: true, message: 'Command sent successfully.' }, { status: 200 });
  } catch (error) {
    console.error('API Error: Failed to process remote command', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to process remote command.', error: errorMessage }, { status: 500 });
  }
}
