
"use client";

import { useGameState } from '@/contexts/game-state-context';
import { CompactHeaderScoreboard } from './compact-header-scoreboard';
import { PenaltiesDisplay } from './penalties-display';
import { ShootoutDisplay } from './shootout-display';

export function FullScoreboard() {
  const { state, isLoading } = useGameState();

  if (isLoading || !state.config || !state.live) {
    return null; // Or a loading spinner, but null is fine to prevent layout shifts
  }

  const { config, live } = state;
  const { scoreboardLayout } = config;
  const { penalties, homeTeamName, awayTeamName, shootout } = live;

  return (
    <div 
      className="flex flex-col transition-transform duration-200"
      style={{
        gap: `${scoreboardLayout.mainContentGap}rem`,
        paddingTop: `${scoreboardLayout.scoreboardVerticalPosition}rem`,
        transform: `translateX(${scoreboardLayout.scoreboardHorizontalPosition}rem)`
      }}
    >
      {!shootout.isActive && <CompactHeaderScoreboard />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10 xl:gap-12">
        {shootout.isActive ? (
          <>
            <ShootoutDisplay team="home" teamName={homeTeamName} attempts={shootout.homeAttempts} totalRounds={shootout.rounds} />
            <ShootoutDisplay team="away" teamName={awayTeamName} attempts={shootout.awayAttempts} totalRounds={shootout.rounds} />
          </>
        ) : (
          <>
            <PenaltiesDisplay teamDisplayType="Local" teamName={homeTeamName} penalties={penalties.home} />
            <PenaltiesDisplay teamDisplayType="Visitante" teamName={awayTeamName} penalties={penalties.away} />
          </>
        )}
      </div>
    </div>
  );
}
