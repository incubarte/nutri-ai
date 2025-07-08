
"use client";

import { useGameState } from '@/contexts/game-state-context';
import { CompactHeaderScoreboard } from './compact-header-scoreboard';
import { PenaltiesDisplay } from './penalties-display';

export function FullScoreboard() {
  const { state, isLoading } = useGameState();

  if (isLoading || !state.config || !state.live) {
    return null; // Or a loading spinner, but null is fine to prevent layout shifts
  }

  const { config, live } = state;
  const { scoreboardLayout } = config;
  const { penalties, homeTeamName, awayTeamName } = live;

  return (
    <div 
      className="flex flex-col transition-transform duration-200"
      style={{
        gap: `${scoreboardLayout.mainContentGap}rem`,
        paddingTop: `${scoreboardLayout.scoreboardVerticalPosition}rem`,
        transform: `translateX(${scoreboardLayout.scoreboardHorizontalPosition}rem)`
      }}
    >
      <CompactHeaderScoreboard />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10 xl:gap-12">
        <PenaltiesDisplay teamDisplayType="Local" teamName={homeTeamName} penalties={penalties.home} />
        <PenaltiesDisplay teamDisplayType="Visitante" teamName={awayTeamName} penalties={penalties.away} />
      </div>
    </div>
  );
}
