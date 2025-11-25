import { NextRequest, NextResponse } from 'next/server';
import { getCurrentMatchVoiceEvents } from '@/lib/voice-event-logger';
import { readFile } from 'fs/promises';
import path from 'path';

/**
 * GET /api/voice/events - Get all voice events for current match
 */
export async function GET() {
  try {
    const events = await getCurrentMatchVoiceEvents();
    return NextResponse.json({
      success: true,
      events,
      count: events.length
    });
  } catch (error) {
    console.error('Error getting voice events:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get voice events'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/voice/events - Clear all voice events for current match
 */
export async function DELETE() {
  try {
    // Get current matchId from live.json
    const livePath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'live.json');
    const liveData = await readFile(livePath, 'utf-8');
    const liveState = JSON.parse(liveData);

    const matchId = liveState.matchId;
    if (!matchId) {
      return NextResponse.json({
        success: false,
        error: 'No active match'
      }, { status: 400 });
    }

    // Get tournamentId from config.json
    const configPath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'config.json');
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    const tournamentId = config.selectedTournamentId;
    if (!tournamentId) {
      return NextResponse.json({
        success: false,
        error: 'No active tournament'
      }, { status: 400 });
    }

    // Clear voice events for this match
    const { clearVoiceEvents } = await import('@/lib/voice-event-logger');
    await clearVoiceEvents(tournamentId, matchId);

    return NextResponse.json({
      success: true,
      message: 'Voice events cleared'
    });
  } catch (error) {
    console.error('Error clearing voice events:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to clear voice events'
    }, { status: 500 });
  }
}
