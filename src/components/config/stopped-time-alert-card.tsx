
"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState, type FormatAndTimingsProfileData } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";

export interface StoppedTimeAlertCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
  setValues: (values: Partial<FormatAndTimingsProfileData>) => void;
}

interface StoppedTimeAlertCardProps {
  onDirtyChange?: (isDirty: boolean) => void;
  initialValues?: Partial<FormatAndTimingsProfileData>;
  isDialogMode?: boolean;
  tempSettings?: Partial<FormatAndTimingsProfileData>;
  onSettingsChange?: (settings: Partial<FormatAndTimingsProfileData>) => void;
}

export const StoppedTimeAlertCard = forwardRef<StoppedTimeAlertCardRef, StoppedTimeAlertCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { onDirtyChange, initialValues: propInitialValues, isDialogMode = false, tempSettings, onSettingsChange } = props;

  const initialValues = propInitialValues || state.config;

  const getInitialState = (key: keyof FormatAndTimingsProfileData) => {
      const value = tempSettings?.[key] ?? initialValues[key as keyof typeof initialValues];
      return value;
  };

  const [localGameTimeMode, setLocalGameTimeMode] = useState<'running' | 'stopped'>(getInitialState('gameTimeMode') as 'running' | 'stopped' || 'stopped');
  const [localAutoActivatePuck, setLocalAutoActivatePuck] = useState(getInitialState('autoActivatePuckPenalties') as boolean);
  const [localEnableAlert, setLocalEnableAlert] = useState(getInitialState('enableStoppedTimeAlert') as boolean);
  const [localGoalDiff, setLocalGoalDiff] = useState(String(getInitialState('stoppedTimeAlertGoalDiff') || 1));
  const [localTimeRemaining, setLocalTimeRemaining] = useState(String(getInitialState('stoppedTimeAlertTimeRemaining') || 2));
  
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  const setValuesFromProfile = (values: Partial<FormatAndTimingsProfileData>) => {
    setLocalGameTimeMode(values.gameTimeMode || 'stopped');
    setLocalAutoActivatePuck(values.autoActivatePuckPenalties || false);
    setLocalEnableAlert(values.enableStoppedTimeAlert || false);
    setLocalGoalDiff(String(values.stoppedTimeAlertGoalDiff || 1));
    setLocalTimeRemaining(String(values.stoppedTimeAlertTimeRemaining || 2));
    setIsDirtyLocal(false);
  };

  useEffect(() => {
    if (!isDialogMode) {
      setValuesFromProfile(initialValues);
    }
  }, [initialValues, isDialogMode]);
  
  const markDirty = () => {
    if (!isDialogMode) setIsDirtyLocal(true);
  };
  
  const handleGameTimeModeChange = (value: 'running' | 'stopped') => {
    setLocalGameTimeMode(value);
    const newAutoActivate = value === 'stopped';
    setLocalAutoActivatePuck(newAutoActivate);
    
    if(onSettingsChange) {
      onSettingsChange({ ...tempSettings, gameTimeMode: value, autoActivatePuckPenalties: newAutoActivate });
    }
    markDirty();
  }

  const handleSwitchChange = (setter: React.Dispatch<React.SetStateAction<boolean>>, value: boolean, key: keyof FormatAndTimingsProfileData) => {
    setter(value);
    if (onSettingsChange) {
      onSettingsChange({ ...tempSettings, [key]: value });
    }
    markDirty();
  };
  
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string, key: keyof FormatAndTimingsProfileData) => {
    setter(value);
    if (onSettingsChange) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        onSettingsChange({ ...tempSettings, [key]: numValue });
      }
    }
    markDirty();
  };

  useEffect(() => {
    if (!isDialogMode) onDirtyChange?.(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange, isDialogMode]);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal || isDialogMode) return true;
      // ... save logic ...
      setIsDirtyLocal(false);
      return true;
    },
    handleDiscard: () => {
      if(!isDialogMode) setValuesFromProfile(initialValues);
    },
    getIsDirty: () => isDirtyLocal,
    setValues: setValuesFromProfile,
  }));
  
  const inputGrid = (
    <div className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-md bg-muted/20">
          <Label htmlFor="enableStoppedTimeAlertSwitch" className="flex flex-col space-y-1">
            <span className="font-semibold text-base">Activar Alerta de Tiempo Frenado</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
              Muestra un aviso para frenar el reloj cuando el partido está ajustado.
            </span>
          </Label>
          <Switch
            id="enableStoppedTimeAlertSwitch"
            checked={localEnableAlert}
            onCheckedChange={(c) => handleSwitchChange(setLocalEnableAlert, c, 'enableStoppedTimeAlert')}
          />
        </div>

        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity", !localEnableAlert && "opacity-50 pointer-events-none")}>
            <div>
              <Label htmlFor="goalDiffInput">Diferencia de Goles (≤)</Label>
              <Input
                id="goalDiffInput"
                type="number"
                value={localGoalDiff}
                onChange={(e) => handleInputChange(setLocalGoalDiff, e.target.value, 'stoppedTimeAlertGoalDiff')}
                disabled={!localEnableAlert}
                className="w-full text-sm"
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="timeRemainingInput">Minutos Restantes Último Período (≤)</Label>
              <Input
                id="timeRemainingInput"
                type="number"
                value={localTimeRemaining}
                onChange={(e) => handleInputChange(setLocalTimeRemaining, e.target.value, 'stoppedTimeAlertTimeRemaining')}
                disabled={!localEnableAlert}
                className="w-full text-sm"
                min="0"
              />
            </div>
        </div>
        <div>
          <Label className="text-base font-semibold">Modo de Tiempo de Juego</Label>
          <RadioGroup 
            value={localGameTimeMode}
            onValueChange={handleGameTimeModeChange}
            className="flex gap-4 mt-2"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="stopped" id="mode-stopped" />
              <Label htmlFor="mode-stopped" className="font-normal cursor-pointer">Tiempo Pausado</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="running" id="mode-running" />
              <Label htmlFor="mode-running" className="font-normal cursor-pointer">Tiempo Corrido</Label>
            </div>
          </RadioGroup>
        </div>
        
        <div className="flex items-center justify-between p-4 border rounded-md bg-muted/20">
          <Label htmlFor="autoActivatePuckSwitch" className="flex flex-col space-y-1">
            <span className="font-semibold text-base">Saltear "Esperando Puck"</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
              Activo: nuevas faltas van a "Esperando Slot". Inactivo: requiere "Puck en Juego".
            </span>
          </Label>
          <Switch
            id="autoActivatePuckSwitch"
            checked={localAutoActivatePuck}
            onCheckedChange={(c) => handleSwitchChange(setLocalAutoActivatePuck, c, 'autoActivatePuckPenalties')}
          />
        </div>

      </div>
  );
  
  if (isDialogMode) {
    return inputGrid;
  }

  return (
    <ControlCardWrapper title="Modo de Juego y Alertas">
       {inputGrid}
    </ControlCardWrapper>
  );
});

StoppedTimeAlertCard.displayName = "StoppedTimeAlertCard";
