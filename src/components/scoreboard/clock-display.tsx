
"use client";

import { useGameState, formatTime, getActualPeriodText, getPeriodText } from '@/contexts/game-state-context';
import { cn } from '@/lib/utils';

interface ClockDisplayProps {
  className?: string;
}

export function ClockDisplay({ className }: ClockDisplayProps) {
  const { state } = useGameState();

  // Guard against rendering with incomplete state during hydration
  if (!state.config || !state.live || !state.live.clock) {
    return null; 
  }

  const { scoreboardLayout } = state.config;
  const { clock, score, homeTeamName, awayTeamName } = state.live;

  const isMainClockLastMinute = clock.currentTime < 6000 && clock.currentTime >= 0 &&
                                (clock.periodDisplayOverride !== "End of Game" && (clock.periodDisplayOverride !== null || clock.currentPeriod >= 0));

  const preTimeoutTimeCs = clock.preTimeoutState?.time;
  const isPreTimeoutLastMinute = typeof preTimeoutTimeCs === 'number' && preTimeoutTimeCs < 6000 && preTimeoutTimeCs >= 0;

  const getWinnerName = () => {
    if (score.home > score.away) {
      return homeTeamName || 'Local';
    } else if (score.away > score.home) {
      return awayTeamName || 'Visitante';
    } else {
      return "Empate";
    }
  };

  return (
    <div className={cn("text-center", className)}>
      {clock.periodDisplayOverride === "End of Game" ? (
        <div className={cn(
          "font-bold font-headline text-accent tracking-tight py-4 md:py-6 lg:py-8 flex flex-col items-center justify-center",
          className
        )}>
          <span style={{ fontSize: `${scoreboardLayout.periodSize * 0.7}rem` }}>Ganador</span>
          <span style={{ fontSize: `${scoreboardLayout.periodSize}rem`}} className="mt-1 md:mt-2">
            {getWinnerName()}
          </span>
        </div>
      ) : (
        <div 
          className={cn(
            "font-bold font-headline tabular-nums tracking-tighter",
            isMainClockLastMinute ? "text-orange-500" : "text-accent"
          )}
          style={{ fontSize: `${scoreboardLayout.clockSize}rem`, lineHeight: 1 }}
          >
          {formatTime(clock.currentTime, { showTenths: isMainClockLastMinute, includeMinutesForTenths: false, rounding: 'down' })}
        </div>
      )}
      {clock.periodDisplayOverride !== "End of Game" && (
        <div 
          className="mt-1 font-semibold text-primary-foreground uppercase tracking-wider relative"
          style={{ fontSize: `${scoreboardLayout.periodSize}rem`, lineHeight: 1.1 }}
        >
          <div className="inline-block relative">
            <span>
              {getActualPeriodText(clock.currentPeriod, clock.periodDisplayOverride, state.config.numberOfRegularPeriods)}
            </span>
            {!clock.isClockRunning && clock.currentTime > 0 && clock.periodDisplayOverride !== "End of Game" && (
              <span
                className="absolute left-full top-1/2 transform -translate-y-1/2 ml-3 font-normal text-muted-foreground normal-case tracking-normal px-2 py-1 bg-background/50 rounded-md whitespace-nowrap"
                style={{ fontSize: '0.4em', lineHeight: 'normal' }}
              >
                Paused
              </span>
            )}
          </div>
        </div>
      )}
      {clock.preTimeoutState && clock.periodDisplayOverride !== "End of Game" && (
        <div className={cn(
            "mt-2 normal-case tracking-normal",
            isPreTimeoutLastMinute ? "text-orange-500/80" : "text-muted-foreground"
          )}
          style={{ fontSize: `${scoreboardLayout.periodSize * 0.45}rem` }}
          >
          {getPeriodText(clock.preTimeoutState.period, state.config.numberOfRegularPeriods)} - {formatTime(clock.preTimeoutState.time, { showTenths: isPreTimeoutLastMinute, includeMinutesForTenths: false, rounding: 'down' })}
          {clock.preTimeoutState.override ? ` (${clock.preTimeoutState.override})` : ''}
        </div>
      )}
    </div>
  );
}
