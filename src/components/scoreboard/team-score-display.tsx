
"use client";

import React, { useState, useEffect, useRef } from 'react';
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
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (score !== prevScore) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 500);
      setPrevScore(score);
      return () => clearTimeout(timer);
    }
  }, [score, prevScore]);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const isOverflow = textRef.current.scrollWidth > containerRef.current.clientWidth;
        setIsOverflowing(isOverflow);
      }
    };
    
    // Check initially and on name change
    checkOverflow();

    // Also check on window resize
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);

  }, [teamActualName]);

  useEffect(() => {
    if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
    }
    
    if (isOverflowing) {
        setIsAtStart(true); // Reset to start
        animationIntervalRef.current = setInterval(() => {
            setIsAtStart(prev => !prev);
        }, 4000); // Toggle every 4 seconds (2s scroll, 2s pause)
    }

    return () => {
        if (animationIntervalRef.current) {
            clearInterval(animationIntervalRef.current);
        }
    };
  }, [isOverflowing]);

  if (!layout) {
    return null;
  }
  
  const getTransform = () => {
    if (!isOverflowing || isAtStart || !containerRef.current || !textRef.current) {
        return 'translateX(0px)';
    }
    const maxScroll = textRef.current.scrollWidth - containerRef.current.clientWidth;
    return `translateX(-${maxScroll}px)`;
  };


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
            className={cn(
              "font-bold text-foreground uppercase tracking-wide w-full h-[1.2em] relative overflow-hidden",
              !isOverflowing && "flex justify-center"
            )}
            ref={containerRef} 
            title={teamActualName}
            style={{ fontSize: `${layout.teamNameSize}rem` }}
          >
              <span
                ref={textRef}
                className="whitespace-nowrap absolute left-0 top-0"
                style={{
                  transform: getTransform(),
                  transition: 'transform 1.5s ease-in-out',
                }}
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
