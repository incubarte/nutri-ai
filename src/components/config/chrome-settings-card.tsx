
"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState } from "@/contexts/game-state-context";
import type { ConfigState } from "@/types";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ChromeSettingsCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
}

interface ChromeSettingsCardProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export const ChromeSettingsCard = forwardRef<ChromeSettingsCardRef, ChromeSettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { onDirtyChange } = props;

  const [localChromePath, setLocalChromePath] = useState(state.config.chromeBinaryPath);
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);
  
  useEffect(() => {
    if (!isDirtyLocal) {
      setLocalChromePath(state.config.chromeBinaryPath);
    }
  }, [state.config.chromeBinaryPath, isDirtyLocal]);

  const markDirty = () => setIsDirtyLocal(true);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return true;
      dispatch({ 
        type: "UPDATE_CONFIG_FIELDS", 
        payload: { chromeBinaryPath: localChromePath }
      });
      setIsDirtyLocal(false);
      return true; 
    },
    handleDiscard: () => {
      setLocalChromePath(state.config.chromeBinaryPath);
      setIsDirtyLocal(false);
    },
    getIsDirty: () => isDirtyLocal,
  }));
  
  return (
    <ControlCardWrapper title="Configuración de Chrome para Ventana Externa">
      <div className="space-y-2 p-4 border rounded-md bg-muted/20">
        <div className="flex items-center gap-2">
            <Label htmlFor="chromePath" className="font-semibold text-base">Ruta del Binario de Chrome</Label>
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-sm">
                        <p className="font-bold mb-1">Ejemplos de Rutas:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li><span className="font-mono bg-muted/50 p-0.5 rounded">/opt/google/chrome/google-chrome</span> (Chrome en Arch Linux)</li>
                            <li><span className="font-mono bg-muted/50 p-0.5 rounded">/usr/bin/chromium</span> (Chromium en Linux)</li>
                            <li><span className="font-mono bg-muted/50 p-0.5 rounded">/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome</span> (macOS)</li>
                        </ul>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
        <p className="text-xs text-muted-foreground">
            Especifica la ruta exacta al ejecutable de Chrome en tu sistema para poder abrir la ventana del scoreboard en un monitor secundario.
        </p>
        <Input
          id="chromePath"
          value={localChromePath}
          onChange={(e) => {
            setLocalChromePath(e.target.value);
            markDirty();
          }}
          placeholder="/usr/bin/google-chrome"
        />
      </div>
    </ControlCardWrapper>
  );
});

ChromeSettingsCard.displayName = "ChromeSettingsCard";
