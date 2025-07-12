
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize, Minimize } from 'lucide-react';
import { BROADCAST_CHANNEL_NAME } from '@/contexts/game-state-context';

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    // We don't control the fullscreen from here directly.
    // Instead, we broadcast a command to all tabs.
    // The scoreboard page will listen for this command and act.
    try {
      const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      channel.postMessage({ type: 'TOGGLE_FULLSCREEN' });
      channel.close();
    } catch (error) {
      console.error("Could not use BroadcastChannel to toggle fullscreen:", error);
      // Fallback for very old browsers or specific environments, though unlikely
      alert("No se pudo comunicar con la pestaña del scoreboard.");
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggleFullscreen}
      aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Entrar a pantalla completa'}
    >
      {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
    </Button>
  );
}
