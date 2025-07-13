
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MonitorPlay, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export function ScoreboardWindowControl() {
  const { toast } = useToast();
  const [posX, setPosX] = useState('1920');
  const [posY, setPosY] = useState('0');

  const handleOpenWindow = () => {
    const width = screen.availWidth;
    const height = screen.availHeight;
    const x = parseInt(posX, 10) || 0;
    const y = parseInt(posY, 10) || 0;

    // Open a blank window first
    const newWindow = window.open('about:blank', 'scoreboardWindow', 'popup=yes');

    if (newWindow) {
      // Then move, resize, and navigate it. This is more reliable.
      newWindow.moveTo(x, y);
      newWindow.resizeTo(width, height);
      newWindow.location.href = '/';
      
      toast({ title: "Ventana Abierta", description: "Scoreboard abierto en una nueva ventana." });
    } else {
      toast({
        title: "Error al Abrir Ventana",
        description: "No se pudo abrir la ventana emergente. Revisa los permisos de tu navegador.",
        variant: "destructive"
      });
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Controlar ventana de scoreboard externa"
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
           <Button onClick={handleOpenWindow} variant="outline" className="justify-start w-full">
            <ExternalLink className="mr-2 h-4 w-4"/>
             Abrir en Ventana Nueva
           </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
