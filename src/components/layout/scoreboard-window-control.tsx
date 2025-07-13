
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MonitorPlay, ExternalLink, X, MonitorUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function ScoreboardWindowControl() {
  const { toast } = useToast();
  const [posX, setPosX] = useState('1920');
  const [posY, setPosY] = useState('0');
  const [port, setPort] = useState('');
  const [isWindowOpen, setIsWindowOpen] = useState(false);

  useEffect(() => {
    // Set port on component mount client-side
    if (typeof window !== 'undefined') {
      setPort(window.location.port || '9002');
    }

    // Check status on mount and periodically
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/puppeteer-control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        });
        const data = await res.json();
        if (data.success) {
          setIsWindowOpen(data.isOpen);
        }
      } catch (error) {
        console.error("Error checking window status:", error);
      }
    };
    
    checkStatus();
    const interval = setInterval(checkStatus, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleWindowAction = async (action: 'open' | 'close') => {
    try {
      const response = await fetch('/api/puppeteer-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, posX, posY, port }),
      });

      const data = await response.json();

      if (data.success) {
        toast({ title: "Acción Completada", description: data.message });
        setIsWindowOpen(action === 'open');
      } else {
        toast({
          title: "Error en la Acción",
          description: data.message || "Ocurrió un error en el servidor.",
          variant: "destructive"
        });
        if (action === 'open') setIsWindowOpen(false);
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
          <p className="text-sm font-medium">Control de Ventana (Kiosk)</p>
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
            <Button onClick={() => handleWindowAction('open')} variant="outline" className="justify-start w-full" disabled={isWindowOpen}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir Scoreboard
            </Button>
            <Button onClick={() => handleWindowAction('close')} variant="destructive" className="justify-start w-full" disabled={!isWindowOpen}>
              <X className="mr-2 h-4 w-4" />
              Cerrar Scoreboard
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
