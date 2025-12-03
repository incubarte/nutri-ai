"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Trophy, Zap, Frame, Sparkles } from "lucide-react";
import type { PlayoffBracketHighlightStyle } from "@/types";

export interface PlayoffBracketSettingsCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
}

interface PlayoffBracketSettingsCardProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export const PlayoffBracketSettingsCard = forwardRef<PlayoffBracketSettingsCardRef, PlayoffBracketSettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { onDirtyChange } = props;

  const [localHighlightStyle, setLocalHighlightStyle] = useState<PlayoffBracketHighlightStyle>(state.config.playoffBracketHighlightStyle);
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);

  useEffect(() => {
    if (!isDirtyLocal) {
      setLocalHighlightStyle(state.config.playoffBracketHighlightStyle);
    }
  }, [state.config.playoffBracketHighlightStyle, isDirtyLocal]);

  const markDirty = () => setIsDirtyLocal(true);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return true;
      dispatch({ type: "UPDATE_CONFIG_FIELDS", payload: { playoffBracketHighlightStyle: localHighlightStyle } });
      setIsDirtyLocal(false);
      return true;
    },
    handleDiscard: () => {
      setLocalHighlightStyle(state.config.playoffBracketHighlightStyle);
      setIsDirtyLocal(false);
    },
    getIsDirty: () => isDirtyLocal,
  }));

  const highlightOptions: { value: PlayoffBracketHighlightStyle; label: string; description: string; icon: React.ReactNode }[] = [
    {
      value: 'pulse',
      label: 'Pulso',
      description: 'Animación de pulso suave con anillo',
      icon: <Zap className="h-5 w-5" />
    },
    {
      value: 'border',
      label: 'Borde Dorado',
      description: 'Borde dorado grueso alrededor del slot',
      icon: <Frame className="h-5 w-5" />
    },
    {
      value: 'glow',
      label: 'Resplandor',
      description: 'Sombra brillante dorada alrededor',
      icon: <Sparkles className="h-5 w-5" />
    },
    {
      value: 'trophy',
      label: 'Trofeo',
      description: 'Icono de trofeo con anillo destacado',
      icon: <Trophy className="h-5 w-5" />
    }
  ];

  return (
    <ControlCardWrapper title="Brackets de Playoffs (Temporal)">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configura cómo se resalta el slot de la final en la vista de playoff durante el warmup. Esta configuración es temporal para elegir la opción que más te guste.
        </p>

        <div className="space-y-3">
          <Label className="text-base font-semibold">Estilo de Resaltado del Slot de Final</Label>
          <RadioGroup value={localHighlightStyle} onValueChange={(value) => { setLocalHighlightStyle(value as PlayoffBracketHighlightStyle); markDirty(); }}>
            {highlightOptions.map((option) => (
              <div key={option.value} className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <RadioGroupItem value={option.value} id={`highlight-${option.value}`} className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor={`highlight-${option.value}`} className="flex items-center gap-2 cursor-pointer font-semibold text-base">
                    {option.icon}
                    {option.label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">{option.description}</p>

                  {/* Visual Preview */}
                  <div className="mt-3 flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Vista previa:</span>
                    <div className="relative">
                      {option.value === 'pulse' && (
                        <div className="animate-pulse ring-4 ring-yellow-500/50 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500 rounded px-3 py-2 text-xs font-bold text-yellow-500">
                          FINAL
                        </div>
                      )}
                      {option.value === 'border' && (
                        <div className="border-4 border-yellow-400 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 rounded px-3 py-2 text-xs font-bold text-yellow-500">
                          FINAL
                        </div>
                      )}
                      {option.value === 'glow' && (
                        <div className="shadow-[0_0_30px_rgba(250,204,21,0.6)] bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500 rounded px-3 py-2 text-xs font-bold text-yellow-500">
                          FINAL
                        </div>
                      )}
                      {option.value === 'trophy' && (
                        <div className="relative ring-4 ring-yellow-500/50 bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500 rounded px-3 py-2 text-xs font-bold text-yellow-500">
                          <Trophy className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-6 text-yellow-500" />
                          <span className="mt-2 inline-block">FINAL</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-600 dark:text-blue-400">
            💡 <strong>Tip:</strong> Abre un partido de playoff durante el warmup para ver el efecto en vivo. Esta configuración es temporal y puede ser removida una vez que elijas tu opción favorita.
          </p>
        </div>
      </div>
    </ControlCardWrapper>
  );
});

PlayoffBracketSettingsCard.displayName = "PlayoffBracketSettingsCard";
