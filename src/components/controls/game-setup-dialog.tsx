

"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import type { DurationSettingsCardRef } from "@/components/config/duration-settings-card";
import type { PenaltySettingsCardRef } from "@/components/config/penalty-settings-card";
import { DurationSettingsCard } from "@/components/config/duration-settings-card";
import { PenaltySettingsCard } from "@/components/config/penalty-settings-card";
import { useGameState, createDefaultFormatAndTimingsProfile } from "@/contexts/game-state-context";

interface GameSetupDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onGameReset: () => void;
}

export function GameSetupDialog({ isOpen, onOpenChange, onGameReset }: GameSetupDialogProps) {
  const { state } = useGameState();
  const { toast } = useToast();
  
  const durationSettingsRef = useRef<DurationSettingsCardRef>(null);
  const penaltySettingsRef = useRef<PenaltySettingsCardRef>(null);
  
  const [isDurationDirty, setIsDurationDirty] = useState(false);
  const [isPenaltyDirty, setIsPenaltyDirty] = useState(false);
  
  const selectedFTProfile = state.config.formatAndTimingsProfiles.find(p => p.id === state.config.selectedFormatAndTimingsProfileId) 
    || state.config.formatAndTimingsProfiles[0] 
    || createDefaultFormatAndTimingsProfile();

  const handleConfirmAndStart = () => {
    let allSavesSuccessful = true;

    if (isDurationDirty && durationSettingsRef.current) {
      if (!durationSettingsRef.current.handleSave()) {
        allSavesSuccessful = false;
      }
    }
    if (isPenaltyDirty && penaltySettingsRef.current) {
      if (!penaltySettingsRef.current.handleSave()) {
        allSavesSuccessful = false;
      }
    }

    if (allSavesSuccessful) {
      if (isDurationDirty || isPenaltyDirty) {
        toast({
          title: "Configuración Aplicada",
          description: "Se han guardado los ajustes para el nuevo partido."
        });
      }
      onGameReset();
      onOpenChange(false);
    } else {
      toast({
        title: "Error al Guardar",
        description: "No se pudieron guardar todos los cambios. Por favor revisa los valores.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configuración del Nuevo Partido</DialogTitle>
          <DialogDescription>
            Revisa o ajusta el formato y los tiempos antes de iniciar. Los cambios se guardarán en el perfil seleccionado y se reiniciará el partido.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto pr-2">
            <PenaltySettingsCard
                ref={penaltySettingsRef}
                onDirtyChange={setIsPenaltyDirty}
                initialValues={selectedFTProfile}
            />
            <Separator />
            <DurationSettingsCard
                ref={durationSettingsRef}
                onDirtyChange={setIsDurationDirty}
                initialValues={selectedFTProfile}
            />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmAndStart}>
            Confirmar e Iniciar Partido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
