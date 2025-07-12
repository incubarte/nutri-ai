"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize, Minimize } from 'lucide-react';

export function FullscreenToggle() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Initial check in case the page loads in fullscreen mode
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        // This error might still happen if the user's browser settings are very strict,
        // but it won't be because of the cross-tab communication issue.
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        alert("No se pudo activar la pantalla completa. Asegúrate de que los permisos del navegador lo permitan.");
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
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
