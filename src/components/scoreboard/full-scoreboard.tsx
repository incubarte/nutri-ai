
"use client";

import { useEffect, useState } from 'react';
import { useGameState, type GameAction } from '@/contexts/game-state-context';
import { CompactHeaderScoreboard } from './compact-header-scoreboard';
import { PenaltiesDisplay } from './penalties-display';
import { ShootoutDisplay, MAX_DISPLAY_SLOTS } from './shootout-display';

const ValentinoCaffeAd = () => {
    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-8 overflow-hidden">
            <h1 
                className="text-4xl md:text-5xl font-semibold text-foreground animate-slide-in-pulse-out"
                style={{ animationDelay: '0s' }}
            >
                Este partido esta muy frio?
            </h1>
            <h2 
                className="text-3xl md:text-4xl font-medium text-muted-foreground animate-slide-in-pulse-out"
                style={{ animationDelay: '1.5s' }}
            >
                Mejor tomate un cafe
            </h2>
            <h3 
                className="text-6xl md:text-7xl font-bold text-accent animate-slide-in-pulse-out"
                style={{ animationDelay: '3s' }}
            >
                Valentino Caffe!
            </h3>
        </div>
    );
};


export function FullScoreboard() {
  const { state, dispatch, isLoading } = useGameState();
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  
  const { config, live } = state;
  const scoreboardLayout = config?.scoreboardLayout;
  
  useEffect(() => {
    if (live?.overlayMessage && live.overlayMessage.id) {
      setOverlayText(live.overlayMessage.text);
      setShowOverlay(true);

      const timer = setTimeout(() => {
        dispatch({ type: 'HIDE_OVERLAY_MESSAGE' });
      }, live.overlayMessage.duration);

      return () => clearTimeout(timer);
    } else {
      setShowOverlay(false);
    }
  }, [live?.overlayMessage, dispatch]);


  if (isLoading || !config || !live) {
    return null; // Or a loading spinner, but null is fine to prevent layout shifts
  }


  const { penalties, homeTeamName, awayTeamName, shootout } = live;

  // Centralize the sliding window logic here, ensuring shootout exists
  const homeAttempts = shootout?.homeAttempts || [];
  const awayAttempts = shootout?.awayAttempts || [];
  const totalRounds = shootout?.rounds || 5;

  const maxAttempts = Math.max(homeAttempts.length, awayAttempts.length);
  // Only start sliding the window after the 5th attempt slot is filled
  const startIdx = Math.max(0, maxAttempts - MAX_DISPLAY_SLOTS);
  const currentRound = homeAttempts.length + awayAttempts.length > 0
    ? Math.max(homeAttempts.length, awayAttempts.length) + (homeAttempts.length === awayAttempts.length ? 1 : 0)
    : 1;


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

      <div className="relative">
          {showOverlay && (
             <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                {overlayText === "Valentino Caffe" ? <ValentinoCaffeAd /> : <p className="text-6xl font-bold text-accent animate-pulse-text">{overlayText}</p>}
            </div>
          )}

          {live.clock.periodDisplayOverride !== 'Shootout' && live.clock.periodDisplayOverride !== 'AwaitingDecision' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10 xl:gap-12">
              <PenaltiesDisplay teamDisplayType="Local" teamName={homeTeamName} penalties={penalties.home} />
              <PenaltiesDisplay teamDisplayType="Visitante" teamName={awayTeamName} penalties={penalties.away} />
            </div>
          ) : live.clock.periodDisplayOverride === 'Shootout' && shootout?.isActive ? (
            <div className="flex flex-col items-center gap-4">
               <h1 
                className="text-accent font-bold uppercase tracking-widest flex items-baseline gap-x-3"
                style={{ fontSize: `${scoreboardLayout.periodSize * 1.5}rem` }}
               >
                 <span>Penales</span>
                 <span 
                    className="text-foreground/80 font-normal"
                    style={{ fontSize: `${scoreboardLayout.periodSize * 1.5 * 0.5}rem` }}
                >
                    (Ronda {currentRound})
                </span>
               </h1>
               <div className="w-full max-w-4xl space-y-4">
                  <ShootoutDisplay team="home" teamName={homeTeamName} attempts={homeAttempts} totalRounds={totalRounds} startIdx={startIdx} />
                  <ShootoutDisplay team="away" teamName={awayTeamName} attempts={awayAttempts} totalRounds={totalRounds} startIdx={startIdx} />
               </div>
            </div>
          ) : null}
      </div>
    </div>
  );
}
