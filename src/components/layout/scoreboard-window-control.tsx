
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
  const [posX, setPosX] = useState('1920');
  const [posY, setPosY] = useState('0');
  const windowRef = useRef<Window | null>(null);
  const [isWindowOpen, setIsWindowOpen] = useState(false);

  useEffect(() => {
    const checkWindow = setInterval(() => {
      setIsWindowOpen(windowRef.current && !windowRef.current.closed);
    }, 1000);

    return () => clearInterval(checkWindow);
  }, []);

  const handleOpenWindow = () => {
    const width = screen.width;
    const height = screen.height;
    const x = parseInt(posX, 10) || 0;
    const y = parseInt(posY, 10) || 0;

    if (windowRef.current && !windowRef.current.closed) {
      windowRef.current.focus();
      toast({ title: "Ventana ya abierta", description: "El scoreboard ya está abierto en otra ventana." });
      return;
    }

    const newWindow = window.open(
      '/',
      'scoreboardWindow',
      `width=${width},height=${height},left=${x},top=${y},menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes,status=yes`
    );

    windowRef.current = newWindow;
    setIsWindowOpen(true);
    toast({ title: "Ventana Abierta", description: "Scoreboard abierto en una nueva ventana." });
  };

  const handleCloseWindow = () => {
    if (windowRef.current && !windowRef.current.closed) {
      windowRef.current.close();
      windowRef.current = null;
      setIsWindowOpen(false);
      toast({ title: "Ventana Cerrada", description: "Se cerró la ventana del scoreboard." });
    } else {
      toast({ title: "Sin ventana", description: "No hay una ventana de scoreboard abierta para cerrar." });
    }
  };

  const handleMaximizeWindow = () => {
    if (windowRef.current && !windowRef.current.closed) {
        windowRef.current.postMessage('REQUEST_FULLSCREEN', '*');
        toast({ title: "Petición Enviada", description: "Se solicitó poner la ventana en pantalla completa." });
    } else {
      toast({ title: "Sin ventana", description: "No hay una ventana de scoreboard abierta para maximizar." });
    }
  };


  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Controlar ventana de scoreboard externa"
          className={cn(isWindowOpen && "text-primary-foreground bg-primary/80")}
        >
          <MonitorPlay className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4 space-y-4">
        <div className="grid gap-4">
          <p className="text-sm font-medium">Control de Ventana del Scoreboard</p>
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
           <Button onClick={handleOpenWindow} variant="outline" className="justify-start w-full" disabled={isWindowOpen}>
            <ExternalLink className="mr-2 h-4 w-4"/>
             Abrir en Ventana Nueva
           </Button>
           <Button onClick={handleMaximizeWindow} variant="outline" className="justify-start w-full" disabled={!isWindowOpen}>
            <MonitorUp className="mr-2 h-4 w-4"/>
             Maximizar Ventana
           </Button>
           <Button onClick={handleCloseWindow} variant="destructive" className="justify-start w-full" disabled={!isWindowOpen}>
             <XCircle className="mr-2 h-4 w-4"/>
             Cerrar Ventana Abierta
           </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
