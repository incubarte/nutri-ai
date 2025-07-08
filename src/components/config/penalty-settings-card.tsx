

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
  setValues: (values: Pick<FormatAndTimingsProfileData, 'maxConcurrentPenalties' | 'playersPerTeamOnIce'>) => void;
}

interface PenaltySettingsCardProps {
  onDirtyChange: (isDirty: boolean) => void;
  initialValues: Pick<FormatAndTimingsProfileData, 'maxConcurrentPenalties' | 'playersPerTeamOnIce'>;
}

export const PenaltySettingsCard = forwardRef<PenaltySettingsCardRef, PenaltySettingsCardProps>((props, ref) => {
  const { dispatch } = useGameState();
  const { onDirtyChange, initialValues } = props;
  
  const [localMaxPenaltiesInput, setLocalMaxPenaltiesInput] = useState(String(initialValues.maxConcurrentPenalties));
  const [localPlayersPerTeamInput, setLocalPlayersPerTeamInput] = useState(String(initialValues.playersPerTeamOnIce));
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  const setValuesFromProfile = (values: Pick<FormatAndTimingsProfileData, 'maxConcurrentPenalties' | 'playersPerTeamOnIce'>) => {
    setLocalMaxPenaltiesInput(String(values.maxConcurrentPenalties));
    setLocalPlayersPerTeamInput(String(values.playersPerTeamOnIce));
    setIsDirtyLocal(false);
  };

  useEffect(() => {
    setValuesFromProfile(initialValues);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);

  const markDirty = () => setIsDirtyLocal(true);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return true;

      const maxPenNum = parseInt(localMaxPenaltiesInput, 10);
      const finalMaxPenalties = (isNaN(maxPenNum) || maxPenNum < 1) ? 1 : maxPenNum;

      const playersNum = parseInt(localPlayersPerTeamInput, 10);
      const finalPlayersPerTeam = (isNaN(playersNum) || playersNum < 1) ? 1 : playersNum;
      
      dispatch({
        type: "UPDATE_SELECTED_FT_PROFILE_DATA",
        payload: {
          maxConcurrentPenalties: finalMaxPenalties,
          playersPerTeamOnIce: finalPlayersPerTeam,
        }
      });
      
      setIsDirtyLocal(false);
      return true;
    },
    handleDiscard: () => {
      setValuesFromProfile(initialValues);
    },
    getIsDirty: () => isDirtyLocal,
    setValues: setValuesFromProfile,
  }));

  return (
    <ControlCardWrapper title="Formato de Juego y Penalidades">
      <div className="space-y-6">
        <div>
          <div className="grid grid-cols-[auto_theme(spacing.24)] items-center gap-x-3 sm:gap-x-4">
            <Label htmlFor="playersPerTeam">Jugadores en Cancha</Label>
            <Input
              id="playersPerTeam"
              type="number"
              value={localPlayersPerTeamInput}
              onChange={(e) => { setLocalPlayersPerTeamInput(e.target.value); markDirty(); }}
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
              onChange={(e) => { setLocalMaxPenaltiesInput(e.target.value); markDirty(); }}
              className="text-sm"
              placeholder="ej. 2"
              min="1"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Define cuántas penalidades pueden correr su tiempo simultáneamente para un mismo equipo. (Ligado a cuántos jugadores menos en cancha puede tener un equipo)
          </p>
        </div>
      </div>
    </ControlCardWrapper>
  );
});

PenaltySettingsCard.displayName = "PenaltySettingsCard";
