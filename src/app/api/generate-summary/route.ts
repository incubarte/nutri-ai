import { NextRequest, NextResponse } from 'next/server';
import { readTournament, readConfig, writeSingleMatchSummary } from '@/lib/data-access';
import { generateSummaryData } from '@/lib/summary-generator';
import fs from 'fs';
import path from 'path';
import type { VoiceGameEvent, GameState } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { matchId } = await request.json();

    if (!matchId) {
      return NextResponse.json({ success: false, error: 'matchId is required' }, { status: 400 });
    }

    // Read config to get selectedTournamentId
    const config = await readConfig();
    const tournamentId = config.selectedTournamentId;

    if (!tournamentId) {
      return NextResponse.json({ success: false, error: 'No tournament selected' }, { status: 400 });
    }

    // Read the full tournament data (needed for team rosters)
    const tournament = await readTournament(tournamentId);
    if (!tournament) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }

    // Build full config with tournaments array (add id to tournament object)
    const fullConfig = {
      ...config,
      tournaments: [{
        id: tournamentId,
        ...tournament
      }]
    };

    // Read current live state
    const livePath = path.join(process.cwd(), 'tmp', 'new-storage', 'data', 'live.json');
    const liveState = JSON.parse(fs.readFileSync(livePath, 'utf-8'));

    // Read voice events for this match
    let voiceEvents: VoiceGameEvent[] = [];
    const voiceEventsPath = path.join(
      process.cwd(),
      'tmp', 'new-storage', 'data', 'tournaments',
      tournamentId,
      'voice-events',
      `${matchId}.json`
    );

    if (fs.existsSync(voiceEventsPath)) {
      const voiceEventsData = fs.readFileSync(voiceEventsPath, 'utf-8');
      voiceEvents = JSON.parse(voiceEventsData);
      console.log(`[Generate Summary API] Loaded ${voiceEvents.length} voice events for match ${matchId}`);
    } else {
      console.log(`[Generate Summary API] No voice events file found for match ${matchId}`);
    }

    // Build state object for summary generation
    const state: GameState = {
      live: liveState,
      config: fullConfig
    };

    // Log debug info
    console.log('[Generate Summary API] Generating summary with:');
    console.log('  - Home team:', liveState.homeTeamName, liveState.homeTeamSubName || '(no subname)');
    console.log('  - Away team:', liveState.awayTeamName, liveState.awayTeamSubName || '(no subname)');
    console.log('  - Selected category:', fullConfig.selectedMatchCategory);
    console.log('  - Tournament teams count:', tournament.teams?.length || 0);
    console.log('  - Voice events count:', voiceEvents.length);

    // Generate summary with voice events
    const summary = generateSummaryData(state, voiceEvents);

    if (!summary) {
      return NextResponse.json({ success: false, error: 'Failed to generate summary' }, { status: 500 });
    }

    console.log('[Generate Summary API] Summary generated. Checking 2ND period stats...');
    const period2nd = summary.statsByPeriod?.find((p: any) => p.period === '2ND');
    if (period2nd) {
      const homeShotsCount = period2nd.stats.playerStats.home.filter((p: any) => p.shots > 0).length;
      const awayShotsCount = period2nd.stats.playerStats.away.filter((p: any) => p.shots > 0).length;
      console.log(`  - Home players with shots in 2ND: ${homeShotsCount}`);
      console.log(`  - Away players with shots in 2ND: ${awayShotsCount}`);
    }

    // Add voice events to summary
    summary.voiceEvents = voiceEvents;

    // Save summary
    await writeSingleMatchSummary(tournamentId, matchId, summary);

    console.log(`[Generate Summary API] Summary generated and saved for match ${matchId} with ${voiceEvents.length} voice events`);

    return NextResponse.json({
      success: true,
      summary,
      voiceEventsCount: voiceEvents.length
    });

  } catch (error) {
    console.error('[Generate Summary API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
