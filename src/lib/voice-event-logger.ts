/**
 * Voice event logger - Saves voice commands to tournaments/{tournamentId}/voice-events/{matchId}.json
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import type { VoiceGameEvent } from '@/types';

/**
 * Get path to voice events file for a specific match
 */
function getVoiceEventsPath(tournamentId: string, matchId: string): string {
  const voiceEventsDir = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'tournaments', tournamentId, 'voice-events');
  return path.join(voiceEventsDir, `${matchId}.json`);
}

/**
 * Get voice events directory path for a tournament
 */
function getVoiceEventsDir(tournamentId: string): string {
  return path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'tournaments', tournamentId, 'voice-events');
}

/**
 * Get path to live.json (to read current matchId and tournamentId)
 */
function getLivePath(): string {
  return path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'live.json');
}

/**
 * Get path to config.json (to read selectedTournamentId)
 */
function getConfigPath(): string {
  return path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'config.json');
}

/**
 * Log a voice event to tournaments/{tournamentId}/voice-events/{matchId}.json
 */
export async function logVoiceEvent(event: VoiceGameEvent): Promise<void> {
  try {
    // Get the current matchId from live.json
    const livePath = getLivePath();
    const liveData = await readFile(livePath, 'utf-8');
    const liveState = JSON.parse(liveData);

    const matchId = liveState.matchId;
    if (!matchId) {
      console.warn('[Voice Logger] No matchId in live state, cannot save voice event');
      return;
    }

    // Get tournamentId from config.json
    const configPath = getConfigPath();
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    const tournamentId = config.selectedTournamentId;
    if (!tournamentId) {
      console.warn('[Voice Logger] No selectedTournamentId in config, cannot save voice event');
      return;
    }

    // Ensure voice-events directory exists
    const voiceEventsDir = getVoiceEventsDir(tournamentId);
    await mkdir(voiceEventsDir, { recursive: true });

    const voiceEventsPath = getVoiceEventsPath(tournamentId, matchId);

    // Read existing events or start with empty array
    let events: VoiceGameEvent[] = [];
    try {
      const existingData = await readFile(voiceEventsPath, 'utf-8');
      events = JSON.parse(existingData);
    } catch (error) {
      // File doesn't exist yet, start fresh
      console.log(`[Voice Logger] Creating new voice-events file for match ${matchId} in tournament ${tournamentId}`);
    }

    // Add new event
    events.push(event);

    // Save updated events
    await writeFile(voiceEventsPath, JSON.stringify(events, null, 2));

    console.log(`[Voice Logger] Logged ${event.action} event to match ${matchId} (total: ${events.length})`);

  } catch (error) {
    console.error('[Voice Logger] Failed to log event:', error);
    throw error;
  }
}

/**
 * Get all voice events for a specific match
 */
export async function getVoiceEvents(tournamentId: string, matchId: string): Promise<VoiceGameEvent[]> {
  try {
    const voiceEventsPath = getVoiceEventsPath(tournamentId, matchId);
    const eventsData = await readFile(voiceEventsPath, 'utf-8');
    return JSON.parse(eventsData);
  } catch (error) {
    // File doesn't exist or error reading - return empty array
    return [];
  }
}

/**
 * Get voice events for current live match
 */
export async function getCurrentMatchVoiceEvents(): Promise<VoiceGameEvent[]> {
  try {
    const livePath = getLivePath();
    const liveData = await readFile(livePath, 'utf-8');
    const liveState = JSON.parse(liveData);

    const matchId = liveState.matchId;
    if (!matchId) {
      return [];
    }

    const configPath = getConfigPath();
    const configData = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configData);

    const tournamentId = config.selectedTournamentId;
    if (!tournamentId) {
      return [];
    }

    return await getVoiceEvents(tournamentId, matchId);
  } catch (error) {
    console.error('[Voice Logger] Failed to get current match events:', error);
    return [];
  }
}

/**
 * Clear all voice events for a specific match (useful for testing)
 */
export async function clearVoiceEvents(tournamentId: string, matchId: string): Promise<void> {
  try {
    const voiceEventsPath = getVoiceEventsPath(tournamentId, matchId);
    await writeFile(voiceEventsPath, JSON.stringify([], null, 2));
    console.log(`[Voice Logger] Cleared all voice events for match ${matchId}`);
  } catch (error) {
    console.error('[Voice Logger] Failed to clear events:', error);
    throw error;
  }
}
