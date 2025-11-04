
"use client";

import React from 'react';
import Image from "next/image";
import { motion } from 'framer-motion';
import type { LiveState } from '@/types';
import { DefaultTeamLogo } from '../teams/default-team-logo';
import { useGameState } from '@/contexts/game-state-context';

interface GoalCelebrationOverlayProps {
  celebration: NonNullable<LiveState['goalCelebration']>;
}

export function GoalCelebrationOverlay({ celebration }: GoalCelebrationOverlayProps) {
  const { goal, teamData } = celebration;
  const { state } = useGameState();
  const { scoreboardLayout } = state.config;
  
  if (!goal) return null;

  const scoringTeamName = goal.team === 'home' ? state.live.homeTeamName : state.live.awayTeamName;

  const opposingTeamType = goal.team === 'home' ? 'away' : 'home';
  const opposingTeamName = state.live[`${opposingTeamType}TeamName`];
  const opposingTeamData = state.config.tournaments
    .find(t => t.id === state.config.selectedTournamentId)?.teams
    .find(t => t.name === opposingTeamName && (t.subName || undefined) === (state.live[`${opposingTeamType}TeamSubName`] || undefined) && t.category === state.config.selectedMatchCategory);


  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-black/50 backdrop-blur-sm overflow-hidden">
        <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.2 }}
            className="flex items-center gap-6"
        >
            {teamData?.logoDataUrl ? (
                <Image
                    src={teamData.logoDataUrl}
                    alt={`${teamData.name} logo`}
                    width={128}
                    height={128}
                    className="w-24 h-24 md:w-32 md:h-32 object-contain"
                    data-ai-hint="team logo"
                />
            ) : (
                <DefaultTeamLogo teamName={scoringTeamName} size="lg" className="w-24 h-24 md:w-32 md:h-32 text-5xl" />
            )}

            <motion.h1
                className="font-headline font-bold text-accent uppercase"
                style={{ fontSize: `${scoreboardLayout.clockSize * 0.8}rem` }}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: [1, 1.15, 1, 1.1, 1], opacity: 1 }}
                transition={{ 
                    delay: 0.5,
                    duration: 1.5,
                    ease: "easeInOut",
                    times: [0, 0.25, 0.5, 0.75, 1],
                    repeat: 1,
                    repeatType: "mirror"
                }}
            >
                GOL!
            </motion.h1>

            {opposingTeamData?.logoDataUrl ? (
                <Image
                    src={opposingTeamData.logoDataUrl}
                    alt={`${opposingTeamData.name} logo`}
                    width={128}
                    height={128}
                    className="w-24 h-24 md:w-32 md:h-32 object-contain"
                    data-ai-hint="team logo"
                />
            ) : (
                <DefaultTeamLogo teamName={opposingTeamName} size="lg" className="w-24 h-24 md:w-32 md:h-32 text-5xl" />
            )}
        </motion.div>

        <motion.div 
            className="text-center mt-4"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 100, damping: 15, delay: 0.4 }}
        >
            <h2 className="text-foreground font-semibold uppercase tracking-wider" style={{ fontSize: `${scoreboardLayout.teamNameSize * 1.2}rem` }}>
                {scoringTeamName}
            </h2>
             <div className="text-primary-foreground mt-2" style={{ fontSize: `${scoreboardLayout.periodSize * 1.1}rem` }}>
                <p>
                    <span className="font-bold">#{goal.scorer?.playerNumber || 'S/N'}</span>
                    <span className="ml-2 font-light">{goal.scorer?.playerName}</span>
                </p>
                {goal.assist?.playerNumber && (
                    <p 
                      className="text-foreground/80 block"
                      style={{ fontSize: '1em' }}
                    >
                        <span className="font-bold">#{goal.assist.playerNumber}</span>
                        <span className="ml-2 font-light">{goal.assist.playerName}</span>
                    </p>
                )}
            </div>
        </motion.div>
    </div>
  );
}
