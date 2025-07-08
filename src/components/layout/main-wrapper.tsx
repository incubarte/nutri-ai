
"use client";

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import React, { useEffect } from 'react';
import { useGameState } from '@/contexts/game-state-context';

export function MainWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state } = useGameState();

  // Safely access scoreboardLayout. If state or state.config is not ready,
  // we cannot apply custom styles yet, but the component can still render.
  const scoreboardLayout = state.config?.scoreboardLayout;
  const isScoreboardPage = pathname === '/';

  useEffect(() => {
    // The effect will only run if scoreboardLayout is defined.
    if (typeof document !== 'undefined' && scoreboardLayout) {
      const root = document.documentElement;
      root.style.setProperty('--background', scoreboardLayout.backgroundColor);
      root.style.setProperty('--primary', scoreboardLayout.primaryColor);
      root.style.setProperty('--accent', scoreboardLayout.accentColor);
    }
  }, [scoreboardLayout]); // Depend on the whole object

  let mainClassName;
  if (isScoreboardPage) {
    mainClassName = "w-full px-4 sm:px-6 lg:px-8 pb-8 pt-0"; // Default scoreboard padding
  } else {
    mainClassName = "container py-8"; // Default for other pages
  }

  return (
    <main className={cn("flex-1", mainClassName)}>
      {children}
    </main>
  );
}
