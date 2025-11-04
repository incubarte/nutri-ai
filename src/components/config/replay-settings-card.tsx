
"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState, type ReplaySettings } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ReplaySettingsCardRef {
  handleSave: () => void;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
}

interface ReplaySettingsCardProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export const ReplaySettingsCard = forwardRef<ReplaySettingsCardRef, ReplaySettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { onDirtyChange } = props;

  const [localSettings, setLocalSettings] = useState<ReplaySettings>(state.config.replays || { syncUrl: '', downloadUrlBase: '' });
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);

  useEffect(() => {
    if (!isDirtyLocal) {
      setLocalSettings(state.config.replays);
    }
  }, [state.config.replays, isDirtyLocal]);

  const markDirty = () => setIsDirtyLocal(true);

  const handleInputChange = (field: keyof ReplaySettings, value: string) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
    markDirty();
  };

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return;
      dispatch({ type: "UPDATE_CONFIG_FIELDS", payload: { replays: localSettings } });
      setIsDirtyLocal(false);
      toast({ title: "Configuración de Replays Guardada", description: "Las URLs para la sincronización de videos han sido actualizadas." });
    },
    handleDiscard: () => {
      setLocalSettings(state.config.replays);
      setIsDirtyLocal(false);
    },
    getIsDirty: () => isDirtyLocal,
  }));

  return (
    <ControlCardWrapper title="Configuración de Sincronización de Replays">
      <div className="space-y-6">
        <div className="space-y-2">
            <Label htmlFor="syncUrl" className="font-semibold text-base">URL de Sincronización (Firebase)</Label>
            <p className="text-xs text-muted-foreground">La URL completa al archivo `.json` en tu Realtime Database que contiene el índice de repeticiones.</p>
            <Input
                id="syncUrl"
                value={localSettings.syncUrl}
                onChange={(e) => handleInputChange('syncUrl', e.target.value)}
                placeholder="https://<project-id>.firebaseio.com/Replays.json"
            />
        </div>
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Label htmlFor="downloadUrlBase" className="font-semibold text-base">URL Base de Descarga (Firebase Storage)</Label>
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild><Info className="h-4 w-4 text-muted-foreground cursor-help" /></TooltipTrigger>
                        <TooltipContent className="max-w-xs text-sm">
                            <p>Esta es la URL base para acceder a los archivos en tu bucket de Storage. Usualmente tiene el formato: `https://firebasestorage.googleapis.com/v0/b/&lt;bucket-name&gt;/o/`</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            <p className="text-xs text-muted-foreground">La URL base a tu bucket de Firebase Storage para construir los enlaces de descarga.</p>
            <Input
                id="downloadUrlBase"
                value={localSettings.downloadUrlBase}
                onChange={(e) => handleInputChange('downloadUrlBase', e.target.value)}
                placeholder="https://firebasestorage.googleapis.com/v0/b/..."
            />
        </div>
      </div>
    </ControlCardWrapper>
  );
});

ReplaySettingsCard.displayName = "ReplaySettingsCard";
