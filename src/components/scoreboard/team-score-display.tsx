
"use client";

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';
import type { ScoreboardLayoutSettings } from '@/types';
import { Button } from '../ui/button';
import Image from 'next/image';

interface TeamScoreDisplayProps {
  teamActualName: string;
  teamDisplayName: "Local" | "Visitante";
  score: number;
  playersOnIce?: number;
  configuredPlayersPerTeam?: number;
  layout?: ScoreboardLayoutSettings;
  logoDataUrl?: string | null;
  className?: string;
  onScoreClick?: () => void;
}

export function TeamScoreDisplay({
  teamActualName,
  teamDisplayName,
  score,
  playersOnIce = 0,
  configuredPlayersPerTeam = 0,
  layout,
  logoDataUrl,
  className,
  onScoreClick
}: TeamScoreDisplayProps) {
  const [flash, setFlash] = useState(false);
  const [prevScore, setPrevScore] = useState(score);
  
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [isAtStart, setIsAtStart] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (score !== prevScore) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 500);
      setPrevScore(score);
      return () => clearTimeout(timer);
    }
  }, [score, prevScore]);

  useLayoutEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const isOverflow = textRef.current.scrollWidth > containerRef.current.clientWidth;
        setIsOverflowing(isOverflow);
      }
    };
    
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);

  }, [teamActualName, layout?.teamNameWidth]);


  useEffect(() => {
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
    
    if (isOverflowing) {
        const delay = isAtStart ? 10000 : 5000;
        animationTimeoutRef.current = setTimeout(() => {
            setIsAtStart(prev => !prev);
        }, delay);
    } else {
      setIsAtStart(true);
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [isOverflowing, isAtStart]);

  if (!layout) {
    return null;
  }
  
  const style: React.CSSProperties = {};
  if (isOverflowing) {
    let translateX = '0px';
    if (!isAtStart && containerRef.current && textRef.current) {
      const maxScroll = textRef.current.scrollWidth - containerRef.current.clientWidth;
      translateX = `-${maxScroll}px`;
    }
    style.transform = `translateX(${translateX})`;
    style.transition = 'transform 1500ms ease-in-out';
  }

  return (
    <div className={cn(
        "relative flex flex-col items-center text-center p-4 rounded-lg",
        className
      )}
      style={{ width: `${layout.teamNameWidth}rem`}}
      >
        {logoDataUrl && (
            <Image
                src={logoDataUrl}
                alt={`${teamActualName} background logo`}
                layout="fill"
                objectFit="contain"
                className="absolute inset-0 z-0 pointer-events-none"
                style={{ opacity: layout.teamLogoOpacity / 100 }}
                data-ai-hint="team logo"
            />
        )}
        <div className="relative z-10 w-full flex flex-col items-center">
            <div className="flex items-center gap-4">
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
            </div>

          <div
            ref={containerRef} 
            className={cn(
              "w-full h-[1.2em] relative overflow-hidden",
              !isOverflowing && "flex justify-center" 
            )}
            style={{ fontSize: `${layout.teamNameSize}rem` }}
            title={teamActualName}
          >
              <span
                ref={textRef}
                className={cn(
                  "font-bold whitespace-nowrap",
                   isOverflowing ? "absolute left-0 top-0" : "text-center w-full"
                )}
                style={style}
              >
                {teamActualName}
              </span>
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
    </div>
  );
}
