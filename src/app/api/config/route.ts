
import { setConfig } from '@/lib/server-side-store';
import { NextResponse } from 'next/server';
import type { ConfigState } from '@/types';

export async function POST(request: Request) {
  try {
    const configData = (await request.json()) as ConfigState;
    if (!configData) {
      return NextResponse.json({ message: 'Invalid config data provided.' }, { status: 400 });
    }
    
    setConfig(configData);
    
    return NextResponse.json({ message: 'Config updated successfully.' }, { status: 200 });
  } catch (error) {
    console.error('API Error: Failed to update config', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ message: 'Failed to update config.', error: errorMessage }, { status: 500 });
  }
}
