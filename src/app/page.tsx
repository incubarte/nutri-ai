
"use client";

import { useEffect, useRef } from 'react';
import { FullScoreboard } from '@/components/scoreboard/full-scoreboard';
import { BROADCAST_CHANNEL_NAME } from '@/contexts/game-state-context';

export default function ScoreboardPage() {
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // This function handles the actual fullscreen logic for this page
    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch((err) => {
          console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    };

    // Listen for commands on the broadcast channel
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'TOGGLE_FULLSCREEN') {
        toggleFullscreen();
      }
    };

    // Initialize the channel
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      if (!channelRef.current) {
        channelRef.current = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      }
      channelRef.current.addEventListener('message', handleMessage);
    }

    // Cleanup on component unmount
    return () => {
      channelRef.current?.removeEventListener('message', handleMessage);
      // We don't close the channel here, as the GameStateProvider might still be using it.
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <FullScoreboard />
    </div>
  );
}
