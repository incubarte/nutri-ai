
"use client";

import type { ShootoutAttempt } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGameState } from '@/contexts/game-state-context';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';

const GoalIcon = ({ className }: { className?: string }) => (
  <motion.div
    initial={{ scale: 0, rotate: -90 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: "spring", stiffness: 260, damping: 20 }}
    className={cn("flex items-center justify-center w-full h-full", className)}
  >
    <Check className="w-full h-full text-green-500" />
  </motion.div>
);

const MissIcon = ({ className }: { className?: string }) => (
  <motion.div
    initial={{ scale: 0.5, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={{ duration: 0.2 }}
    className={cn("flex items-center justify-center w-full h-full", className)}
  >
    <X className="w-full h-full text-destructive" />
  </motion.div>
);

const PlaceholderIcon = ({ className }: { className?: string }) => (
    <div className={`flex items-center justify-center ${className}`}>
        <div className="w-1/2 h-1/2 bg-muted/20 rounded-full" />
    </div>
);


interface ShootoutDisplayProps {
  team: 'home' | 'away';
  teamName: string;
  attempts: ShootoutAttempt[];
  totalRounds: number;
  startIdx: number; // New prop to control the sliding window
}

export const MAX_DISPLAY_SLOTS = 5;

export function ShootoutDisplay({ team, teamName, attempts, totalRounds, startIdx }: ShootoutDisplayProps) {
  const { state } = useGameState();

  if (!state.config) {
    return null;
  }

  const { scoreboardLayout } = state.config;
  const goalCount = attempts.filter(a => a.isGoal).length;
  
  // Use the startIdx from props to slice the attempts
  const attemptsToShow = attempts.slice(startIdx, startIdx + MAX_DISPLAY_SLOTS);
  
  const slots = Array.from({ length: MAX_DISPLAY_SLOTS }).map((_, index) => {
      // Adjust the index to match the overall attempt number from the sliced array
      const attemptIndexInFullArray = startIdx + index;
      const attempt = attempts[attemptIndexInFullArray];
      
      if (attempt) {
          if(attempt.isGoal) {
            return <GoalIcon key={attempt.id} className="w-full h-full" />;
          } else {
            return <MissIcon key={attempt.id} className="w-full h-full" />;
          }
      }
      // Show placeholder if this round is expected
      if (attemptIndexInFullArray < totalRounds) {
        return <PlaceholderIcon key={`placeholder-${index}`} className="w-full h-full" />;
      }
      return null;
  }).filter(Boolean);


  return (
    <Card className="bg-card shadow-lg flex-1">
      <CardHeader className="p-3 md:p-6 flex flex-row items-center justify-between">
        <CardTitle 
          className="text-primary-foreground"
          style={{ fontSize: `${scoreboardLayout.penaltiesTitleSize}rem` }}
        >
          {teamName}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
        <div className="grid grid-cols-6 gap-2 md:gap-4">
            <AnimatePresence>
              {slots.map((slot, index) => (
                  <motion.div
                    key={attempts.find((a, i) => i === startIdx + index)?.id || `placeholder-${index}`}
                    className="aspect-square bg-muted/30 rounded-md p-1 md:p-2"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                  >
                    {slot}
                  </motion.div>
              ))}
            </AnimatePresence>
             {/* Goal Count Box */}
            <motion.div
                className="aspect-square bg-accent/20 border-2 border-accent/50 rounded-md flex items-center justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
            >
                <span
                    className="text-accent font-bold font-headline"
                    style={{ fontSize: `${scoreboardLayout.scoreSize * 0.6}rem` }}
                >
                    {goalCount}
                </span>
            </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}
