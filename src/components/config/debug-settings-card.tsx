

"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface DebugSettingsCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
}

interface DebugSettingsCardProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export const DebugSettingsCard = forwardRef<DebugSettingsCardRef, DebugSettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { onDirtyChange } = props;

  const [localEnableDebugMode, setLocalEnableDebugMode] = useState(state.config.enableDebugMode);
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);

  useEffect(() => {
    if (!isDirtyLocal) {
      setLocalEnableDebugMode(state.config.enableDebugMode);
    }
  }, [state.config.enableDebugMode, isDirtyLocal]);

  const markDirty = () => setIsDirtyLocal(true);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return true;
      dispatch({ type: "UPDATE_CONFIG_FIELDS", payload: { enableDebugMode: localEnableDebugMode } });
      setIsDirtyLocal(false);
      return true;
    },
    handleDiscard: () => {
      setLocalEnableDebugMode(state.config.enableDebugMode);
      setIsDirtyLocal(false);
    },
    getIsDirty: () => isDirtyLocal,
  }));

  return (
    <ControlCardWrapper title="Desarrollo y Debug">
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-md bg-muted/20">
          <Label htmlFor="enableDebugModeSwitch" className="flex flex-col space-y-1">
            <span className="font-semibold text-base">Habilitar Modo Debug</span>
            <span className="font-normal leading-snug text-muted-foreground text-xs">
              Muestra información técnica adicional en la página de Controles, como el reloj de tiempo absoluto.
            </span>
          </Label>
          <Switch
            id="enableDebugModeSwitch"
            checked={localEnableDebugMode}
            onCheckedChange={(checked) => { setLocalEnableDebugMode(checked); markDirty(); }}
          />
        </div>
      </div>
    </ControlCardWrapper>
  );
});

DebugSettingsCard.displayName = "DebugSettingsCard";
