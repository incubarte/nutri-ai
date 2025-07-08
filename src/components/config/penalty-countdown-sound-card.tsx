

"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef, useRef } from "react";
import { useGameState, DEFAULT_PENALTY_BEEP_PATH } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { UploadCloud, XCircle, Info, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface PenaltyCountdownSoundCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
}

interface PenaltyCountdownSoundCardProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export const PenaltyCountdownSoundCard = forwardRef<PenaltyCountdownSoundCardRef, PenaltyCountdownSoundCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { onDirtyChange } = props;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [localEnableSound, setLocalEnableSound] = useState(state.config.enablePenaltyCountdownSound);
  const [localCountdownTime, setLocalCountdownTime] = useState(String(state.config.penaltyCountdownStartTime));
  const [localCustomSoundDataUrl, setLocalCustomSoundDataUrl] = useState(state.config.customPenaltyBeepSoundDataUrl);
  const [customSoundFileName, setCustomSoundFileName] = useState<string | null>(null);
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);

  useEffect(() => {
    if (!isDirtyLocal) {
      setLocalEnableSound(state.config.enablePenaltyCountdownSound);
      setLocalCountdownTime(String(state.config.penaltyCountdownStartTime));
      setLocalCustomSoundDataUrl(state.config.customPenaltyBeepSoundDataUrl);
      setCustomSoundFileName(null);
    }
  }, [state.config.enablePenaltyCountdownSound, state.config.penaltyCountdownStartTime, state.config.customPenaltyBeepSoundDataUrl, isDirtyLocal]);

  const markDirty = () => setIsDirtyLocal(true);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return true;

      const countdownTime = parseInt(localCountdownTime, 10);
      
      dispatch({ 
        type: "UPDATE_CONFIG_FIELDS", 
        payload: {
          enablePenaltyCountdownSound: localEnableSound,
          penaltyCountdownStartTime: isNaN(countdownTime) ? 10 : countdownTime,
          customPenaltyBeepSoundDataUrl: localCustomSoundDataUrl,
        }
      });
      
      setIsDirtyLocal(false);
      return true;
    },
    handleDiscard: () => {
      setLocalEnableSound(state.config.enablePenaltyCountdownSound);
      setLocalCountdownTime(String(state.config.penaltyCountdownStartTime));
      setLocalCustomSoundDataUrl(state.config.customPenaltyBeepSoundDataUrl);
      setCustomSoundFileName(null);
      setIsDirtyLocal(false);
    },
    getIsDirty: () => isDirtyLocal,
  }));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("audio/")) {
      toast({
        title: "Archivo no Soportado",
        description: "Por favor, selecciona un archivo de audio (ej. MP3, WAV, OGG).",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 1 * 1024 * 1024) { // 1MB limit for beeps
      toast({
        title: "Archivo Demasiado Grande",
        description: "El tamaño máximo del archivo de sonido es 1MB.",
        variant: "destructive",
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setLocalCustomSoundDataUrl(dataUrl);
      setCustomSoundFileName(file.name);
      markDirty();
      toast({
        title: "Sonido de Beep Cargado",
        description: `"${file.name}" listo para usar. Guarda los cambios.`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleClearCustomSound = () => {
    setLocalCustomSoundDataUrl(null);
    setCustomSoundFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    markDirty();
    toast({
      title: "Sonido de Beep Eliminado",
      description: "Se usará el sonido predeterminado. Guarda los cambios.",
    });
  };
  
  const currentSoundDisplayName = localCustomSoundDataUrl
      ? (customSoundFileName || "Sonido Personalizado Cargado")
      : `Predeterminado (${DEFAULT_PENALTY_BEEP_PATH.split('/').pop() || 'penalty_beep.wav'})`;

  return (
    <ControlCardWrapper title="Sonido de Countdown de Penalidad">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-md bg-muted/20">
          <Label htmlFor="enableCountdownSoundSwitch" className="flex flex-col space-y-1">
            <span>Habilitar Sonido de Countdown</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
              Activa para escuchar un "beep" cada segundo cuando una penalidad está por expirar.
            </span>
          </Label>
          <Switch
            id="enableCountdownSoundSwitch"
            checked={localEnableSound}
            onCheckedChange={(checked) => { setLocalEnableSound(checked); markDirty(); }}
          />
        </div>

        <div className={cn("space-y-4 transition-opacity duration-300", !localEnableSound && "opacity-50 pointer-events-none")}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 p-4 border rounded-md bg-muted/20">
                <div className="flex items-center gap-2">
                    <Timer className="h-5 w-5 text-muted-foreground" />
                    <Label htmlFor="countdown-time">Iniciar sonido a los (seg):</Label>
                </div>
                <Input
                    id="countdown-time"
                    type="number"
                    value={localCountdownTime}
                    onChange={(e) => {
                        if (/^\d*$/.test(e.target.value)) {
                            setLocalCountdownTime(e.target.value);
                            markDirty();
                        }
                    }}
                    className="w-24 text-sm"
                    placeholder="10"
                    min="1"
                    disabled={!localEnableSound}
                />
            </div>
            <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                <Label htmlFor="custom-beep-sound-file" className="text-base font-medium">Sonido de Beep Personalizado</Label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                     <div className="flex items-center gap-2 text-sm text-muted-foreground flex-grow min-w-0">
                        <span>Sonido actual:</span>
                        <span className="font-semibold text-card-foreground truncate max-w-[160px] xs:max-w-[200px] sm:max-w-xs md:max-w-sm" title={currentSoundDisplayName}>
                            {currentSoundDisplayName}
                        </span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-9" disabled={!localEnableSound}>
                        <UploadCloud className="mr-2 h-4 w-4" /> Cargar (max 1MB)
                      </Button>
                      {localCustomSoundDataUrl && (
                        <Button type="button" variant="destructive" onClick={handleClearCustomSound} className="h-9" disabled={!localEnableSound}>
                          <XCircle className="mr-2 h-4 w-4" /> Usar Pred.
                        </Button>
                      )}
                    </div>
                </div>
                 <Input
                    id="custom-beep-sound-file"
                    type="file"
                    accept="audio/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={!localEnableSound}
                />
            </div>
        </div>
      </div>
    </ControlCardWrapper>
  );
});

PenaltyCountdownSoundCard.displayName = "PenaltyCountdownSoundCard";
