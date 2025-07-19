

"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState, type FormatAndTimingsProfileData, centisecondsToDisplayMinutes } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface StoppedTimeAlertCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
  setValues: (values: Partial<FormatAndTimingsProfileData>) => void;
}

interface StoppedTimeAlertCardProps {
  onDirtyChange: (isDirty: boolean) => void;
  initialValues: Partial<FormatAndTimingsProfileData>;
}

export const StoppedTimeAlertCard = forwardRef<StoppedTimeAlertCardRef, StoppedTimeAlertCardProps>((props, ref) => {
  const { dispatch } = useGameState();
  const { onDirtyChange, initialValues } = props;

  const [localEnableAlert, setLocalEnableAlert] = useState(initialValues.enableStoppedTimeAlert || false);
  const [localGoalDiff, setLocalGoalDiff] = useState(String(initialValues.stoppedTimeAlertGoalDiff || 1));
  const [localTimeRemaining, setLocalTimeRemaining] = useState(String(initialValues.stoppedTimeAlertTimeRemaining || 2));
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  const setValuesFromProfile = (values: Partial<FormatAndTimingsProfileData>) => {
    setLocalEnableAlert(values.enableStoppedTimeAlert || false);
    setLocalGoalDiff(String(values.stoppedTimeAlertGoalDiff || 1));
    setLocalTimeRemaining(String(values.stoppedTimeAlertTimeRemaining || 2));
    setIsDirtyLocal(false);
  };

  useEffect(() => {
    setValuesFromProfile(initialValues);
  }, [initialValues]);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);

  const markDirty = () => setIsDirtyLocal(true);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return true;

      const goalDiff = parseInt(localGoalDiff, 10);
      const timeRemaining = parseInt(localTimeRemaining, 10);
      
      const updates = {
        enableStoppedTimeAlert: localEnableAlert,
        stoppedTimeAlertGoalDiff: isNaN(goalDiff) || goalDiff < 0 ? 1 : goalDiff,
        stoppedTimeAlertTimeRemaining: isNaN(timeRemaining) || timeRemaining < 0 ? 2 : timeRemaining,
      };

      dispatch({ type: "UPDATE_SELECTED_FT_PROFILE_DATA", payload: updates });
      
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
    <ControlCardWrapper title="Alerta de Tiempo Frenado">
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-md bg-muted/20">
          <Label htmlFor="enableStoppedTimeAlertSwitch" className="flex flex-col space-y-1">
            <span className="font-semibold text-base">Activar Alerta</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
              Muestra un aviso en Controles para frenar el reloj si la diferencia de goles y el tiempo son bajos.
            </span>
          </Label>
          <Switch
            id="enableStoppedTimeAlertSwitch"
            checked={localEnableAlert}
            onCheckedChange={(checked) => { setLocalEnableAlert(checked); markDirty(); }}
          />
        </div>

        <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity", !localEnableAlert && "opacity-50 pointer-events-none")}>
            <div>
              <Label htmlFor="goalDiffInput">Diferencia de Goles (≤)</Label>
              <Input
                id="goalDiffInput"
                type="number"
                value={localGoalDiff}
                onChange={(e) => { setLocalGoalDiff(e.target.value); markDirty(); }}
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
                onChange={(e) => { setLocalTimeRemaining(e.target.value); markDirty(); }}
                disabled={!localEnableAlert}
                className="w-full text-sm"
                min="0"
              />
            </div>
        </div>
      </div>
    </ControlCardWrapper>
  );
});

StoppedTimeAlertCard.displayName = "StoppedTimeAlertCard";
