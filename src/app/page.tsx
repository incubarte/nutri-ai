"use client";

import { FullScoreboard } from '@/components/scoreboard/full-scoreboard';

export default function ScoreboardPage() {
  // The fullscreen logic is now self-contained within the FullscreenToggle
  // component, which is only rendered on this page by the Header component.
  // No extra logic is needed here.

  return (
    <div className="w-full h-full flex flex-col">
      <FullScoreboard />
    </div>
  );
}
