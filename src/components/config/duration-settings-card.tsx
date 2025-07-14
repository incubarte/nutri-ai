

"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { 
  useGameState, 
  centisecondsToDisplayMinutes, 
  centisecondsToDisplaySeconds,
  type FormatAndTimingsProfileData
} from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export interface DurationSettingsCardRef {
  handleSave: () => boolean; 
  handleDiscard: () => void;
  getIsDirty: () => boolean;
  setValues: (values: FormatAndTimingsProfileData) => void;
}

interface DurationSettingsCardProps {
  onDirtyChange: (isDirty: boolean) => void;
  initialValues: FormatAndTimingsProfileData;
}

const narrowInputStyle = "w-24 text-sm";

export const DurationSettingsCard = forwardRef<DurationSettingsCardRef, DurationSettingsCardProps>((props, ref) => {
  const { dispatch } = useGameState();
  const { onDirtyChange, initialValues } = props;

  const [localWarmUpDurationInput, setLocalWarmUpDurationInput] = useState('');
  const [localPeriodDurationInput, setLocalPeriodDurationInput] = useState('');
  const [localOTPeriodDurationInput, setLocalOTPeriodDurationInput] = useState('');
  const [localBreakDurationInput, setLocalBreakDurationInput] = useState('');
  const [localPreOTBreakDurationInput, setLocalPreOTBreakDurationInput] = useState('');
  const [localTimeoutDurationInput, setLocalTimeoutDurationInput] = useState('');
  
  const [localAutoStartWarmUp, setLocalAutoStartWarmUp] = useState(false);
  const [localAutoStartBreaks, setLocalAutoStartBreaks] = useState(false);
  const [localAutoStartPreOTBreaks, setLocalAutoStartPreOTBreaks] = useState(false);
  const [localAutoStartTimeouts, setLocalAutoStartTimeouts] = useState(false);

  const [localNumRegularPeriodsInput, setLocalNumRegularPeriodsInput] = useState('');
  const [localNumOTPeriodsInput, setLocalNumOTPeriodsInput] = useState('');

  const [isDirtyLocal, setIsDirtyLocal] = useState(false);

  const setValuesFromProfile = (values: FormatAndTimingsProfileData) => {
    setLocalWarmUpDurationInput(centisecondsToDisplayMinutes(values.defaultWarmUpDuration));
    setLocalPeriodDurationInput(centisecondsToDisplayMinutes(values.defaultPeriodDuration));
    setLocalOTPeriodDurationInput(centisecondsToDisplayMinutes(values.defaultOTPeriodDuration));
    setLocalBreakDurationInput(centisecondsToDisplaySeconds(values.defaultBreakDuration));
    setLocalPreOTBreakDurationInput(centisecondsToDisplaySeconds(values.defaultPreOTBreakDuration));
    setLocalTimeoutDurationInput(centisecondsToDisplaySeconds(values.defaultTimeoutDuration));
    setLocalAutoStartWarmUp(values.autoStartWarmUp);
    setLocalAutoStartBreaks(values.autoStartBreaks);
    setLocalAutoStartPreOTBreaks(values.autoStartPreOTBreaks);
    setLocalAutoStartTimeouts(values.autoStartTimeouts);
    setLocalNumRegularPeriodsInput(String(values.numberOfRegularPeriods));
    setLocalNumOTPeriodsInput(String(values.numberOfOvertimePeriods));
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

      const updates: Partial<FormatAndTimingsProfileData> = {};

      const warmUpDurationMin = parseInt(localWarmUpDurationInput, 10);
      updates.defaultWarmUpDuration = (isNaN(warmUpDurationMin) || warmUpDurationMin < 1) ? (60 * 100) : warmUpDurationMin * 60 * 100;

      const periodDurationMin = parseInt(localPeriodDurationInput, 10);
      updates.defaultPeriodDuration = (isNaN(periodDurationMin) || periodDurationMin < 1) ? (60 * 100) : periodDurationMin * 60 * 100;

      const otPeriodDurationMin = parseInt(localOTPeriodDurationInput, 10);
      updates.defaultOTPeriodDuration = (isNaN(otPeriodDurationMin) || otPeriodDurationMin < 1) ? (60 * 100) : otPeriodDurationMin * 60 * 100;

      const breakDurationSec = parseInt(localBreakDurationInput, 10);
      updates.defaultBreakDuration = (isNaN(breakDurationSec) || breakDurationSec < 1) ? (1 * 100) : breakDurationSec * 100;

      const preOTBreakDurationSec = parseInt(localPreOTBreakDurationInput, 10);
      updates.defaultPreOTBreakDuration = (isNaN(preOTBreakDurationSec) || preOTBreakDurationSec < 1) ? (1 * 100) : preOTBreakDurationSec * 100;
      
      const timeoutDurationSec = parseInt(localTimeoutDurationInput, 10);
      updates.defaultTimeoutDuration = (isNaN(timeoutDurationSec) || timeoutDurationSec < 1) ? (1 * 100) : timeoutDurationSec * 100;

      const numRegularPeriods = parseInt(localNumRegularPeriodsInput, 10);
      updates.numberOfRegularPeriods = (isNaN(numRegularPeriods) || numRegularPeriods < 1) ? 3 : numRegularPeriods;

      const numOTPeriods = parseInt(localNumOTPeriodsInput, 10);
      updates.numberOfOvertimePeriods = (isNaN(numOTPeriods) || numOTPeriods < 0) ? 1 : numOTPeriods;
      
      updates.autoStartWarmUp = localAutoStartWarmUp;
      updates.autoStartBreaks = localAutoStartBreaks;
      updates.autoStartPreOTBreaks = localAutoStartPreOTBreaks;
      updates.autoStartTimeouts = localAutoStartTimeouts;
      
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
    <ControlCardWrapper title="Configuración de Tiempos, Períodos y Arranque Automático">
      <div className="grid grid-cols-[auto_theme(spacing.24)_auto_auto] items-center gap-x-3 sm:gap-x-4 gap-y-6">
        
        <Label htmlFor="numRegularPeriods" className="text-sm whitespace-nowrap">Períodos Regulares (Cant)</Label>
        <Input
          id="numRegularPeriods"
          type="number"
          value={localNumRegularPeriodsInput}
          onChange={(e) => { setLocalNumRegularPeriodsInput(e.target.value); markDirty(); }}
          className={cn(narrowInputStyle)}
          placeholder="ej. 3"
          min="1"
        />
        <Label htmlFor="periodDuration" className="text-sm whitespace-nowrap justify-self-end">Duración (Min)</Label>
        <Input
          id="periodDuration"
          type="number"
          value={localPeriodDurationInput}
          onChange={(e) => { setLocalPeriodDurationInput(e.target.value); markDirty(); }}
          className={cn(narrowInputStyle)}
          placeholder="ej. 20"
          min="1"
        />

        <Label htmlFor="numOTPeriods" className="text-sm whitespace-nowrap">Períodos Overtime (Cant)</Label>
        <Input
          id="numOTPeriods"
          type="number"
          value={localNumOTPeriodsInput}
          onChange={(e) => { setLocalNumOTPeriodsInput(e.target.value); markDirty(); }}
          className={cn(narrowInputStyle)}
          placeholder="ej. 1"
          min="0"
        />
        <Label htmlFor="otPeriodDuration" className="text-sm whitespace-nowrap justify-self-end">Duración (Min)</Label>
        <Input
          id="otPeriodDuration"
          type="number"
          value={localOTPeriodDurationInput}
          onChange={(e) => { setLocalOTPeriodDurationInput(e.target.value); markDirty(); }}
          className={cn(narrowInputStyle)}
          placeholder="ej. 5"
          min="1"
        />
        
        <Label htmlFor="timeoutDurationConfig" className="text-sm whitespace-nowrap">Timeout (seg)</Label>
        <Input
          id="timeoutDurationConfig"
          type="number"
          value={localTimeoutDurationInput}
          onChange={(e) => { setLocalTimeoutDurationInput(e.target.value); markDirty(); }}
          className={cn(narrowInputStyle)}
          placeholder="ej. 30"
          min="1"
        />
        <Label htmlFor="autoStartTimeoutsConfig" className="font-normal text-sm whitespace-nowrap justify-self-end">Iniciar Autom.</Label>
        <Switch
          id="autoStartTimeoutsConfig"
          checked={localAutoStartTimeouts}
          onCheckedChange={(checked) => { setLocalAutoStartTimeouts(checked); markDirty(); }}
        />

        <Label htmlFor="breakDurationConfig" className="text-sm whitespace-nowrap">Descanso Reg. (seg)</Label>
        <Input
          id="breakDurationConfig"
          type="number"
          value={localBreakDurationInput}
          onChange={(e) => { setLocalBreakDurationInput(e.target.value); markDirty(); }}
          className={cn(narrowInputStyle)}
          placeholder="ej. 120"
          min="1"
        />
        <Label htmlFor="autoStartBreaksConfig" className="font-normal text-sm whitespace-nowrap justify-self-end">Iniciar Autom.</Label>
        <Switch
          id="autoStartBreaksConfig"
          checked={localAutoStartBreaks}
          onCheckedChange={(checked) => { setLocalAutoStartBreaks(checked); markDirty(); }}
        />

        <Label htmlFor="preOTBreakDurationConfig" className="text-sm whitespace-nowrap">Descanso Pre-OT (seg)</Label>
        <Input
          id="preOTBreakDurationConfig"
          type="number"
          value={localPreOTBreakDurationInput}
          onChange={(e) => { setLocalPreOTBreakDurationInput(e.target.value); markDirty(); }}
          className={cn(narrowInputStyle)}
          placeholder="ej. 60"
          min="1"
        />
        <Label htmlFor="autoStartPreOTBreaksConfig" className="font-normal text-sm whitespace-nowrap justify-self-end">Iniciar Autom.</Label>
        <Switch
          id="autoStartPreOTBreaksConfig"
          checked={localAutoStartPreOTBreaks}
          onCheckedChange={(checked) => { setLocalAutoStartPreOTBreaks(checked); markDirty(); }}
        />

        <Label htmlFor="warmUpDurationConfig" className="text-sm whitespace-nowrap">Calentamiento (min)</Label>
        <Input
          id="warmUpDurationConfig"
          type="number"
          value={localWarmUpDurationInput}
          onChange={(e) => { setLocalWarmUpDurationInput(e.target.value); markDirty(); }}
          className={cn(narrowInputStyle)}
          placeholder="ej. 5"
          min="1"
        />
        <Label htmlFor="autoStartWarmUpConfig" className="font-normal text-sm whitespace-nowrap justify-self-end">Iniciar Autom.</Label>
        <Switch
          id="autoStartWarmUpConfig"
          checked={localAutoStartWarmUp}
          onCheckedChange={(checked) => { setLocalAutoStartWarmUp(checked); markDirty(); }}
        />
      </div>
    </ControlCardWrapper>
  );
});

DurationSettingsCard.displayName = "DurationSettingsCard";
