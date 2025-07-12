
"use client";

import React from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Monitor, MonitorPlay, XCircle, MonitorUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ScoreboardWindowControl() {
  const { scoreboardWindow, dispatch } = useGameState();
  const { toast } = useToast();

  const handleOpenWindow = () => {
    const sbWindow = scoreboardWindow.current;
    if (sbWindow && !sbWindow.closed) {
      sbWindow.focus();
      toast({ title: "Ventana ya abierta", description: "La ventana del scoreboard ya está abierta." });
      return;
    }

    const newWindow = window.open('/', 'IceVisionScoreboard', 'width=1280,height=720,resizable=yes,scrollbars=yes');
    if (newWindow) {
      dispatch({ type: 'SET_SCOREBOARD_WINDOW', payload: newWindow });
      toast({ title: "Ventana Abierta", description: "El scoreboard se ha abierto en una nueva ventana." });

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
    const sbWindow = scoreboardWindow.current;
    if (sbWindow && !sbWindow.closed) {
      sbWindow.close();
      dispatch({ type: 'CLEAR_SCOREBOARD_WINDOW' });
      toast({ title: "Ventana Cerrada", description: "La ventana del scoreboard ha sido cerrada." });
    }
  };

  const handleMaximizeWindow = () => {
    const sbWindow = scoreboardWindow.current;
    if (sbWindow && !sbWindow.closed) {
        sbWindow.postMessage('REQUEST_FULLSCREEN', '*');
        sbWindow.focus();
        toast({ title: "Comando Enviado", description: "Se envió la orden de maximizar a la ventana del scoreboard." });
    } else {
        toast({ title: "Ventana no Encontrada", description: "No se puede maximizar porque la ventana no está abierta.", variant: "destructive" });
    }
  };

  const isWindowOpen = scoreboardWindow.current && !scoreboardWindow.current.closed;

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
           <Button onClick={handleOpenWindow} disabled={!!isWindowOpen} variant="outline" className="justify-start">
             <Monitor className="mr-2 h-4 w-4"/>
             Abrir Scoreboard
           </Button>
           <Button onClick={handleMaximizeWindow} disabled={!isWindowOpen} variant="outline" className="justify-start">
             <MonitorUp className="mr-2 h-4 w-4"/>
             Maximizar Scoreboard
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
