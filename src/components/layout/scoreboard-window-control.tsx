
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { MonitorPlay, XCircle, MonitorUp, ExternalLink, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function ScoreboardWindowControl() {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [posX, setPosX] = useState('1920');
  const [posY, setPosY] = useState('0');

  const handleKioskOpen = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/puppeteer-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', x: parseInt(posX) || 0, y: parseInt(posY) || 0 }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Acción Enviada", description: "Se ha abierto el scoreboard en modo kiosco." });
      } else {
        throw new Error(data.message || 'Error desconocido del servidor.');
      }
    } catch (error) {
      toast({
        title: "Error al Abrir Kiosco",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKioskClose = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/puppeteer-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: "Acción Enviada", description: "Se cerró la instancia del navegador del kiosco." });
      } else {
        toast({ title: "Aviso", description: data.message || "No había instancia que cerrar.", variant: "default" });
      }
    } catch (error) {
       toast({
        title: "Error al Cerrar Kiosco",
        description: (error as Error).message,
        variant: "destructive"
      });
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
          className={cn(isProcessing ? "text-primary-foreground bg-primary/80 animate-pulse" : "text-foreground/60")}
        >
          {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : <MonitorPlay className="h-5 w-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 space-y-4">
        <div className="grid gap-4">
          <p className="text-sm font-medium">Control de Kiosco (Puppeteer)</p>
          <div className="flex gap-2 items-end">
            <div>
              <Label htmlFor="pos-x" className="text-xs">Posición X</Label>
              <Input id="pos-x" value={posX} onChange={e => setPosX(e.target.value)} className="h-8 w-20" placeholder="0" />
            </div>
             <div>
              <Label htmlFor="pos-y" className="text-xs">Posición Y</Label>
              <Input id="pos-y" value={posY} onChange={e => setPosY(e.target.value)} className="h-8 w-20" placeholder="0" />
            </div>
          </div>
          <Button onClick={handleKioskOpen} variant="outline" className="justify-start w-full" disabled={isProcessing}>
            <ExternalLink className="mr-2 h-4 w-4"/>
             Abrir Scoreboard Kiosco
           </Button>
           <Button onClick={handleKioskClose} variant="destructive" className="justify-start w-full" disabled={isProcessing}>
             <XCircle className="mr-2 h-4 w-4"/>
             Forzar Cierre de Kioscos
           </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

