
"use client";

// This component's core functionality (TeamScore) has been extracted to TeamScoreDisplay.
// It's kept here for now in case it's used elsewhere or for future reference,
// but it's not directly used by FullScoreboard in the new layout.
// You might consider removing it if it's confirmed to be unused.

import { useGameState } from '@/contexts/game-state-context';
import { Card, CardContent } from '@/components/ui/card';
import React from 'react'; // useEffect, useState, cn were for the extracted TeamScore
import { TeamScoreDisplay } from './team-score-display'; // For reference or potential minimal usage

export function ScoreDisplay() {
  const { state } = useGameState();

  if (!state.live || !state.config) {
    return null;
  }

  // If you still need a ScoreDisplay wrapper for some reason,
  // it would likely just use TeamScoreDisplay components.
  // For example, if you wanted to restore the old layout elsewhere:
  return (
    <Card className="bg-card shadow-xl">
      <CardContent className="p-3 md:p-4 flex justify-around items-start">
        <TeamScoreDisplay teamActualName={state.live.homeTeamName} teamDisplayName="Local" score={state.live.score.home} />
        <div className="text-2xl md:text-4xl font-bold text-primary-foreground mx-1 md:mx-4 self-center pt-6 md:pt-10">
          VS
        </div>
        <TeamScoreDisplay teamActualName={state.live.awayTeamName} teamDisplayName="Visitante" score={state.live.score.away} />
      </CardContent>
    </Card>
  );
}

