
"use client";

import React, { useEffect, useState } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Monitor, MonitorPlay, XCircle, MonitorUp, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function ScoreboardWindowControl() {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [secondMonitorX, setSecondMonitorX] = useState('1920'); // Valor por defecto común
  const [secondMonitorY, setSecondMonitorY] = useState('0'); // Valor por defecto

  const isWindowOpen = state.config.puppeteerWindow.status === 'open';

  // Sincronizar estado al cargar
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/puppeteer-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        });
        const data = await res.json();
        if (data.success) {
          dispatch({ type: 'SET_PUPPETEER_WINDOW_STATE', payload: { status: data.status } });
        }
      } catch (e) {
        console.error("Error fetching puppeteer status", e);
      }
    };
    checkStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePuppeteerControl = async (action: 'open' | 'close') => {
    setIsProcessing(true);
    try {
      const scoreboardUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}/`;
      
      const response = await fetch('/api/puppeteer-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, url: scoreboardUrl, secondMonitorX, secondMonitorY }),
      });
      const data = await response.json();

      if (data.success) {
        dispatch({ type: 'SET_PUPPETEER_WINDOW_STATE', payload: { status: action === 'open' ? 'open' : 'closed' } });
        toast({ title: "Acción Completada", description: data.message });
      } else {
        toast({ title: "Error", description: data.message, variant: "destructive" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error de red";
      toast({ title: "Error de Conexión", description: errorMessage, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Controlar ventana de scoreboard externa"
          className={isWindowOpen ? "text-primary-foreground bg-primary/80" : "text-foreground/60"}
        >
          <MonitorPlay className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 space-y-4">
        <div className="grid gap-2">
          <Button onClick={() => handlePuppeteerControl('open')} disabled={isWindowOpen || isProcessing} variant="outline" className="justify-start">
            {isProcessing && !isWindowOpen ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Monitor className="mr-2 h-4 w-4"/>}
             Abrir Scoreboard Kiosco
           </Button>
           <Button onClick={() => handlePuppeteerControl('close')} disabled={!isWindowOpen || isProcessing} variant="destructive" className="justify-start">
             {isProcessing && isWindowOpen ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
             Cerrar Scoreboard Kiosco
           </Button>
        </div>
        <div className="border-t pt-4 space-y-2">
          <Label className="text-xs font-semibold">Posición del 2do Monitor</Label>
          <div className="flex items-center gap-2">
            <div>
              <Label htmlFor="monitor-x" className="text-xs text-muted-foreground">X:</Label>
              <Input id="monitor-x" value={secondMonitorX} onChange={(e) => setSecondMonitorX(e.target.value)} className="w-20 h-8" placeholder="1920" />
            </div>
            <div>
               <Label htmlFor="monitor-y" className="text-xs text-muted-foreground">Y:</Label>
              <Input id="monitor-y" value={secondMonitorY} onChange={(e) => setSecondMonitorY(e.target.value)} className="w-20 h-8" placeholder="0" />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
