
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MonitorPlay, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useGameState } from '@/contexts/game-state-context';

export function ScoreboardWindowControl() {
  const { state } = useGameState();
  const { toast } = useToast();
  const [posX, setPosX] = useState('1920');
  const [posY, setPosY] = useState('0');
  const [port, setPort] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPort(window.location.port || '9002');
    }
  }, []);

  const handleOpenWindow = async () => {
    try {
      const response = await fetch('/api/window-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', posX, posY, port, chromePath: state.config.chromeBinaryPath }),
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: "Acción Completada", description: data.message });
      } else {
        toast({
          title: "Error en la Acción",
          description: data.message || "Ocurrió un error en el servidor.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error sending window action:", error);
      toast({
        title: "Error de Red",
        description: "No se pudo comunicar con el servidor para controlar la ventana.",
        variant: "destructive"
      });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Controlar ventana de scoreboard externa">
          <MonitorPlay className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 space-y-4">
        <div className="grid gap-4">
          <p className="text-sm font-medium">Control de Ventana Externa</p>
          <div className="flex gap-2 items-end">
            <div>
              <Label htmlFor="pos-x" className="text-xs">Posición X</Label>
              <Input id="pos-x" value={posX} onChange={e => setPosX(e.target.value)} className="h-8 w-20" placeholder="1920" />
            </div>
            <div>
              <Label htmlFor="pos-y" className="text-xs">Posición Y</Label>
              <Input id="pos-y" value={posY} onChange={e => setPosY(e.target.value)} className="h-8 w-20" placeholder="0" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleOpenWindow} variant="outline" className="justify-start w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir Scoreboard
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
