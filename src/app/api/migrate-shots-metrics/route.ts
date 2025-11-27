import { NextResponse } from 'next/server';
import { readLiveState, readShotsMetrics, writeShotsMetrics, writeLiveState } from '@/lib/data-access';
import type { ShotsMetrics } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Migration endpoint to move shotsLog and goalkeeperChangesLog from live.json to live-shotsMetrics.json
 * This is a one-time migration that can be called manually or automatically on first load
 */
export async function POST(request: Request) {
  try {
    console.log('[Migration] Starting shots metrics migration...');

    // Read current live state
    const liveState = await readLiveState();

    if (!liveState) {
      return NextResponse.json({
        success: false,
        message: 'No live state found to migrate'
      }, { status: 404 });
    }

    // Check if migration is needed
    const hasMetricsInLive = liveState.shotsLog || liveState.goalkeeperChangesLog;

    if (!hasMetricsInLive) {
      return NextResponse.json({
        success: true,
        message: 'No metrics found in live.json - already migrated or no data to migrate',
        migrated: false
      });
    }

    // Extract metrics from live state
    const shotsMetrics: ShotsMetrics = {
      shotsLog: liveState.shotsLog || { home: [], away: [] },
      goalkeeperChangesLog: liveState.goalkeeperChangesLog || { home: [], away: [] }
    };

    // Write to new file
    await writeShotsMetrics(shotsMetrics);

    // Remove from live.json (optional - for clean separation)
    const { shotsLog, goalkeeperChangesLog, ...liveWithoutMetrics } = liveState as any;
    await writeLiveState(liveWithoutMetrics);

    console.log('[Migration] Migration completed successfully');
    console.log(`  - Migrated ${shotsMetrics.shotsLog.home.length} home shots`);
    console.log(`  - Migrated ${shotsMetrics.shotsLog.away.length} away shots`);
    console.log(`  - Migrated ${shotsMetrics.goalkeeperChangesLog.home.length} home GK changes`);
    console.log(`  - Migrated ${shotsMetrics.goalkeeperChangesLog.away.length} away GK changes`);

    return NextResponse.json({
      success: true,
      message: 'Migration completed successfully',
      migrated: true,
      stats: {
        homeShotsCount: shotsMetrics.shotsLog.home.length,
        awayShotsCount: shotsMetrics.shotsLog.away.length,
        homeGKChangesCount: shotsMetrics.goalkeeperChangesLog.home.length,
        awayGKChangesCount: shotsMetrics.goalkeeperChangesLog.away.length
      }
    });

  } catch (error) {
    console.error('[Migration] Error during migration:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error during migration'
    }, { status: 500 });
  }
}
