"use client";

import { FullScoreboard } from '@/components/scoreboard/full-scoreboard';
import { ScoreboardActions } from '@/components/scoreboard/scoreboard-actions';

export default function ScoreboardPage() {
  return (
    <div className="w-full h-full flex flex-col relative">
      <ScoreboardActions />
      <FullScoreboard />
    </div>
  );
}
