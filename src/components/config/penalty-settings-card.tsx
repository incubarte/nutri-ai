

"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState, type FormatAndTimingsProfileData } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export interface PenaltySettingsCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
  setValues: (values: Partial<FormatAndTimingsProfileData>) => void;
}

interface PenaltySettingsCardProps {
  onDirtyChange?: (isDirty: boolean) => void;
  initialValues?: Partial<FormatAndTimingsProfileData>;
  isDialogMode?: boolean;
  tempSettings?: Partial<FormatAndTimingsProfileData>;
  onSettingsChange?: (settings: Partial<FormatAndTimingsProfileData>) => void;
}

export const PenaltySettingsCard = forwardRef<PenaltySettingsCardRef, PenaltySettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { onDirtyChange, initialValues: propInitialValues, isDialogMode = false, tempSettings, onSettingsChange } = props;

  const initialValues = propInitialValues || state.config;

  const getInitialState = (key: keyof FormatAndTimingsProfileData) => {
    const value = tempSettings?.[key] ?? initialValues[key as keyof typeof initialValues];
    return String(value);
  };
  
  const [localMaxPenaltiesInput, setLocalMaxPenaltiesInput] = useState(getInitialState('maxConcurrentPenalties'));
  const [localPlayersPerTeamInput, setLocalPlayersPerTeamInput] = useState(getInitialState('playersPerTeamOnIce'));
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  const setValuesFromProfile = (values: Partial<FormatAndTimingsProfileData>) => {
    setLocalMaxPenaltiesInput(String(values.maxConcurrentPenalties));
    setLocalPlayersPerTeamInput(String(values.playersPerTeamOnIce));
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
  
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string, key: keyof FormatAndTimingsProfileData) => {
    setter(value);
    if (onSettingsChange) {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        onSettingsChange({ ...tempSettings, [key]: numValue });
      }
    }
    markDirty();
  }

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
        <div>
          <div className="grid grid-cols-[auto_theme(spacing.24)] items-center gap-x-3 sm:gap-x-4">
            <Label htmlFor="playersPerTeam">Jugadores en Cancha</Label>
            <Input
              id="playersPerTeam"
              type="number"
              value={localPlayersPerTeamInput}
              onChange={(e) => handleInputChange(setLocalPlayersPerTeamInput, e.target.value, 'playersPerTeamOnIce')}
              className="text-sm"
              placeholder="ej. 5"
              min="1"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Número de jugadores de campo por equipo (excluyendo al arquero).
          </p>
        </div>
        
        <div>
          <div className="grid grid-cols-[auto_theme(spacing.24)] items-center gap-x-3 sm:gap-x-4">
            <Label htmlFor="maxConcurrentPenalties">Máximo Penalidades Concurrentes</Label>
            <Input
              id="maxConcurrentPenalties"
              type="number"
              value={localMaxPenaltiesInput}
              onChange={(e) => handleInputChange(setLocalMaxPenaltiesInput, e.target.value, 'maxConcurrentPenalties')}
              className="text-sm"
              placeholder="ej. 2"
              min="1"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Define cuántas penalidades pueden correr su tiempo simultáneamente para un mismo equipo.
          </p>
        </div>
      </div>
  );

  if (isDialogMode) {
    return inputGrid;
  }

  return (
    <ControlCardWrapper title="Formato de Juego y Penalidades">
      {inputGrid}
    </ControlCardWrapper>
  );
});

PenaltySettingsCard.displayName = "PenaltySettingsCard";
