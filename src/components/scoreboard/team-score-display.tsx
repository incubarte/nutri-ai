

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';
import type { ScoreboardLayoutSettings } from '@/types';
import { Button } from '../ui/button';

interface TeamScoreDisplayProps {
  teamActualName: string;
  teamDisplayName: "Local" | "Visitante";
  score: number;
  playersOnIce?: number;
  configuredPlayersPerTeam?: number;
  layout?: ScoreboardLayoutSettings;
  className?: string;
  onScoreClick?: () => void;
}

const LONG_NAME_THRESHOLD = 8; 
const SCROLL_ANIMATION_DURATION_MS = 1500; 
const PAUSE_AT_START_DURATION_MS = 5000;   
const PAUSE_AT_END_DURATION_MS = 2000;     

export function TeamScoreDisplay({
  teamActualName,
  teamDisplayName,
  score,
  playersOnIce = 0,
  configuredPlayersPerTeam = 0,
  layout,
  className,
  onScoreClick
}: TeamScoreDisplayProps) {
  const [flash, setFlash] = useState(false);
  const [prevScore, setPrevScore] = useState(score);

  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [currentScrollX, setCurrentScrollX] = useState(0);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isLongName = teamActualName.length > LONG_NAME_THRESHOLD;

  useEffect(() => {
    if (score !== prevScore) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 500);
      setPrevScore(score);
      return () => clearTimeout(timer);
    }
  }, [score, prevScore]);

  useEffect(() => {
    const clearCurrentAnimationTimeout = () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
    };

    clearCurrentAnimationTimeout();
    setCurrentScrollX(0); 

    if (isLongName) {
      const performAnimationCycle = () => {
        if (!containerRef.current || !textRef.current) {
          animationTimeoutRef.current = setTimeout(performAnimationCycle, 100);
          return;
        }
        
        setCurrentScrollX(0);

        animationTimeoutRef.current = setTimeout(() => {
          if (containerRef.current && textRef.current) {
            const containerWidth = containerRef.current.offsetWidth;
            const textWidth = textRef.current.scrollWidth;
            const maxScroll = textWidth - containerWidth;

            if (maxScroll > 0) {
              setCurrentScrollX(-maxScroll);

              animationTimeoutRef.current = setTimeout(() => {
                setCurrentScrollX(0); 

                animationTimeoutRef.current = setTimeout(() => {
                  performAnimationCycle();
                }, PAUSE_AT_START_DURATION_MS + SCROLL_ANIMATION_DURATION_MS);
              }, PAUSE_AT_END_DURATION_MS + SCROLL_ANIMATION_DURATION_MS);
            } else {
              setCurrentScrollX(0);
            }
          }
        }, PAUSE_AT_START_DURATION_MS);
      };
      
      animationTimeoutRef.current = setTimeout(performAnimationCycle, 100); 

    } else {
      setCurrentScrollX(0);
    }

    return clearCurrentAnimationTimeout;
  }, [teamActualName, isLongName]);


  if (!layout) {
    return null; // Return nothing if layout is not ready
  }

  return (
    <div className={cn(
        "flex flex-col items-center text-center",
        "min-w-[120px] sm:min-w-[140px] md:min-w-[160px] lg:min-w-[180px] xl:min-w-[200px]",
        className
      )}>
      <div className="flex justify-center items-center gap-1 mb-1 h-5 md:h-6 lg:h-7">
        {playersOnIce > 0 && Array(playersOnIce).fill(null).map((_, index) => (
          <User 
            key={index} 
            className="text-primary-foreground/80" 
            style={{ 
              height: `${layout.playersOnIceIconSize}rem`,
              width: `${layout.playersOnIceIconSize}rem`
            }}
          />
        ))}
        {configuredPlayersPerTeam > 0 && playersOnIce === 0 && (
          <span className="text-sm md:text-base lg:text-lg text-destructive animate-pulse">0 JUGADORES</span>
        )}
      </div>

      <div
        className={cn(
          "font-bold text-foreground uppercase tracking-wide w-full h-[1.2em] relative",
          isLongName ? "overflow-hidden" : "text-center"
        )}
        ref={isLongName ? containerRef : null} 
        title={teamActualName}
        style={{ fontSize: `${layout.teamNameSize}rem` }}
      >
        {isLongName ? (
          <span
            ref={textRef}
            className="whitespace-nowrap absolute left-0 top-0"
            style={{
              transform: `translateX(${currentScrollX}px)`,
              transitionProperty: 'transform',
              transitionDuration: `${SCROLL_ANIMATION_DURATION_MS}ms`,
              transitionTimingFunction: 'ease-in-out',
            }}
          >
            {teamActualName}
          </span>
        ) : (
          <span className="truncate">
            {teamActualName}
          </span>
        )}
      </div>

      <p 
        className="text-muted-foreground -mt-0.5 md:-mt-1"
        style={{ fontSize: `${layout.teamLabelSize}rem`}}
      >
        ({teamDisplayName})
      </p>
       <Button 
          variant="link" 
          onClick={onScoreClick} 
          className={cn(
              "font-bold font-headline text-accent tabular-nums tracking-tighter p-0 h-auto hover:no-underline hover:text-accent/80",
              flash && "animate-score-flash"
            )}
          style={{
            fontSize: `${layout.scoreSize}rem`,
            marginTop: `${layout.scoreLabelGap}rem`
          }}
        >
        {score}
      </Button>
    </div>
  );
}
