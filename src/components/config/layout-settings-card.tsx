
"use client";

import React, { useMemo, forwardRef, useImperativeHandle, useState, useEffect } from "react";
import { useGameState, type ScoreboardLayoutSettings } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { INITIAL_LAYOUT_SETTINGS } from "@/contexts/game-state-context";

// --- Color Conversion Helpers ---
function hexToHsl(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return "0 0% 0%";

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    
    return `${h} ${s}% ${l}%`;
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;

    let c = (1 - Math.abs(2 * l - 1)) * s,
        x = c * (1 - Math.abs((h / 60) % 2 - 1)),
        m = l - c/2,
        r = 0,
        g = 0,
        b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    const toHex = (c: number) => c.toString(16).padStart(2, '0');

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
// --- End Color Conversion Helpers ---


const SliderControl = ({ label, value, onValueChange, min, max, step, unit = "rem" }: { label: string, value: number, onValueChange: (value: number) => void, min: number, max: number, step: number, unit?: string }) => (
  <div className="grid grid-cols-3 items-center gap-x-4">
    <Label className="text-sm whitespace-nowrap">{label}</Label>
    <Slider
      value={[value]}
      onValueChange={(v) => onValueChange(v[0])}
      min={min}
      max={max}
      step={step}
    />
    <span className="text-sm text-muted-foreground tabular-nums">{value.toFixed(2)} {unit}</span>
  </div>
);

const ColorControl = ({ label, value, onValueChange, defaultValue }: { label: string, value: string, onValueChange: (value: string) => void, defaultValue: string }) => {
    const hexValue = useMemo(() => {
        try {
            const [h, s, l] = value.split(" ").map(v => parseFloat(v.replace('%', '')));
            return hslToHex(h, s, l);
        } catch (e) {
            return '#000000';
        }
    }, [value]);

    const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newHex = e.target.value;
        onValueChange(hexToHsl(newHex));
    };

    return (
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 sm:gap-x-4">
            <Label className="text-sm whitespace-nowrap">{label}</Label>
            <input
                type="color"
                value={hexValue}
                onChange={handleColorInputChange}
                className="w-10 h-10 p-0 border-none rounded-md cursor-pointer bg-transparent"
                title="Hacer clic para cambiar color"
            />
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onValueChange(defaultValue)}
                        >
                           <RotateCcw className="h-4 w-4 text-muted-foreground" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Restablecer color por defecto</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
};

export interface LayoutSettingsCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
}

interface LayoutSettingsCardProps {
  initialValues: ScoreboardLayoutSettings;
}

export const LayoutSettingsCard = forwardRef<LayoutSettingsCardRef, LayoutSettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { scoreboardLayout, selectedScoreboardLayoutProfileId } = state.config;
  
  const handleValueChange = (key: keyof ScoreboardLayoutSettings, value: number | string) => {
    dispatch({ type: 'UPDATE_LAYOUT_SETTINGS', payload: { [key]: value } });
  };
  
  useImperativeHandle(ref, () => ({
    handleSave: () => {
      dispatch({ type: 'SAVE_CURRENT_LAYOUT_TO_PROFILE' });
      return true;
    },
    handleDiscard: () => {
      if (selectedScoreboardLayoutProfileId) {
        dispatch({ type: 'SELECT_SCOREBOARD_LAYOUT_PROFILE', payload: { profileId: selectedScoreboardLayoutProfileId }});
      }
    }
  }));

  return (
    <ControlCardWrapper title="Diseño del Scoreboard (Vista Previa en Vivo)">
      <div className="space-y-6">
        <div>
          <h4 className="text-base font-semibold mb-3">Posición y Espaciado (en rem)</h4>
           <div className="space-y-4">
            <SliderControl label="Posición Vertical" value={scoreboardLayout.scoreboardVerticalPosition} onValueChange={(v) => handleValueChange('scoreboardVerticalPosition', v)} min={-4} max={20} step={0.5} />
            <SliderControl label="Posición Horizontal" value={scoreboardLayout.scoreboardHorizontalPosition} onValueChange={(v) => handleValueChange('scoreboardHorizontalPosition', v)} min={-20} max={20} step={0.5} />
            <SliderControl label="Espacio Principal" value={scoreboardLayout.mainContentGap} onValueChange={(v) => handleValueChange('mainContentGap', v)} min={0} max={10} step={0.25} />
          </div>
        </div>
        <div className="border-t pt-6">
          <h4 className="text-base font-semibold mb-3">Tamaños de Texto e Iconos (en rem)</h4>
           <div className="space-y-4">
            <SliderControl label="Reloj Principal" value={scoreboardLayout.clockSize} onValueChange={(v) => handleValueChange('clockSize', v)} min={6} max={20} step={0.5} />
            <SliderControl label="Nombre Equipo" value={scoreboardLayout.teamNameSize} onValueChange={(v) => handleValueChange('teamNameSize', v)} min={1.5} max={6} step={0.1} />
            <SliderControl label="Puntuación (Goles)" value={scoreboardLayout.scoreSize} onValueChange={(v) => handleValueChange('scoreSize', v)} min={4} max={12} step={0.25} />
            <SliderControl label="Espacio Goles/Label" value={scoreboardLayout.scoreLabelGap} onValueChange={(v) => handleValueChange('scoreLabelGap', v)} min={-2} max={2} step={0.05} />
            <SliderControl label="Período" value={scoreboardLayout.periodSize} onValueChange={(v) => handleValueChange('periodSize', v)} min={2} max={8} step={0.1} />
            <SliderControl label="Iconos Jugadores" value={scoreboardLayout.playersOnIceIconSize} onValueChange={(v) => handleValueChange('playersOnIceIconSize', v)} min={1} max={4} step={0.1} />
            <SliderControl label="Categoría Partido" value={scoreboardLayout.categorySize} onValueChange={(v) => handleValueChange('categorySize', v)} min={0.75} max={3} step={0.05} />
            <SliderControl label="Label Local/Visitante" value={scoreboardLayout.teamLabelSize} onValueChange={(v) => handleValueChange('teamLabelSize', v)} min={0.75} max={3} step={0.05} />
            <SliderControl label="Título Penalidades" value={scoreboardLayout.penaltiesTitleSize} onValueChange={(v) => handleValueChange('penaltiesTitleSize', v)} min={1} max={4} step={0.1} />
            <SliderControl label="Nº Jugador Penalidad" value={scoreboardLayout.penaltyPlayerNumberSize} onValueChange={(v) => handleValueChange('penaltyPlayerNumberSize', v)} min={1.5} max={7} step={0.1} />
            <SliderControl label="Tiempo Penalidad" value={scoreboardLayout.penaltyTimeSize} onValueChange={(v) => handleValueChange('penaltyTimeSize', v)} min={1.5} max={7} step={0.1} />
            <SliderControl label="Icono Jugador Penalidad" value={scoreboardLayout.penaltyPlayerIconSize} onValueChange={(v) => handleValueChange('penaltyPlayerIconSize', v)} min={1} max={5} step={0.1} />
          </div>
        </div>
        <div className="border-t pt-6">
           <h4 className="text-base font-semibold mb-3">Colores Principales</h4>
           <div className="space-y-3">
             <ColorControl label="Color de Fondo" value={scoreboardLayout.backgroundColor} onValueChange={(v) => handleValueChange('backgroundColor', v)} defaultValue={INITIAL_LAYOUT_SETTINGS.backgroundColor} />
             <ColorControl label="Color Primario" value={scoreboardLayout.primaryColor} onValueChange={(v) => handleValueChange('primaryColor', v)} defaultValue={INITIAL_LAYOUT_SETTINGS.primaryColor} />
             <ColorControl label="Color de Acento" value={scoreboardLayout.accentColor} onValueChange={(v) => handleValueChange('accentColor', v)} defaultValue={INITIAL_LAYOUT_SETTINGS.accentColor} />
           </div>
        </div>
      </div>
    </ControlCardWrapper>
  );
});
LayoutSettingsCard.displayName = "LayoutSettingsCard";
