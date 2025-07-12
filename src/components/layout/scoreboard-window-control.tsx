
"use client";

import React from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Monitor, MonitorPlay, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ScoreboardWindowControl() {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const scoreboardWindow = state.live.scoreboardWindow;

  const handleOpenWindow = () => {
    if (scoreboardWindow && !scoreboardWindow.closed) {
      scoreboardWindow.focus();
      toast({ title: "Ventana ya abierta", description: "La ventana del scoreboard ya está abierta." });
      return;
    }

    const newWindow = window.open('/', 'IceVisionScoreboard', 'width=1280,height=720,resizable=yes,scrollbars=yes');
    if (newWindow) {
      dispatch({ type: 'SET_SCOREBOARD_WINDOW', payload: newWindow });
      toast({ title: "Ventana Abierta", description: "El scoreboard se ha abierto en una nueva ventana." });

      // Check if the window is closed
      const checkInterval = setInterval(() => {
        if (newWindow.closed) {
          clearInterval(checkInterval);
          dispatch({ type: 'CLEAR_SCOREBOARD_WINDOW' });
        }
      }, 1000);
    } else {
      toast({
        title: "Error al Abrir Ventana",
        description: "El navegador bloqueó la apertura de la ventana emergente. Por favor, permite las ventanas emergentes para este sitio.",
        variant: "destructive"
      });
    }
  };

  const handleCloseWindow = () => {
    if (scoreboardWindow && !scoreboardWindow.closed) {
      scoreboardWindow.close();
      dispatch({ type: 'CLEAR_SCOREBOARD_WINDOW' });
      toast({ title: "Ventana Cerrada", description: "La ventana del scoreboard ha sido cerrada." });
    }
  };

  const isWindowOpen = scoreboardWindow && !scoreboardWindow.closed;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Controlar ventana de scoreboard"
          className={isWindowOpen ? "text-primary-foreground bg-primary/80" : "text-foreground/60"}
        >
          <MonitorPlay className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2">
        <div className="flex flex-col gap-2">
           <Button onClick={handleOpenWindow} disabled={isWindowOpen} variant="outline" className="justify-start">
             <Monitor className="mr-2 h-4 w-4"/>
             Abrir Scoreboard
           </Button>
           <Button onClick={handleCloseWindow} disabled={!isWindowOpen} variant="destructive" className="justify-start">
             <XCircle className="mr-2 h-4 w-4"/>
             Cerrar Scoreboard
           </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
