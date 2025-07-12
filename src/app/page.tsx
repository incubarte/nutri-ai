"use client";

import { FullScoreboard } from '@/components/scoreboard/full-scoreboard';

export default function ScoreboardPage() {
  return (
    <div className="w-full h-full flex flex-col relative">
      <FullScoreboard />
    </div>
  );
}
