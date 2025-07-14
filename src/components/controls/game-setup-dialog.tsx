

"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
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
import { useGameState, createDefaultFormatAndTimingsProfile, formatTime } from "@/contexts/game-state-context";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import type { FormatAndTimingsProfileData } from "@/types";

interface GameSetupDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onGameReset: () => void;
}

const ConfirmationView = ({ profileData, onBack }: { profileData: FormatAndTimingsProfileData; onBack: () => void; }) => {
  const summaryItems = [
    { label: "Períodos Regulares", value: `${profileData.numberOfRegularPeriods} x ${formatTime(profileData.defaultPeriodDuration, { showTenths: false })}` },
    { label: "Períodos Overtime", value: `${profileData.numberOfOvertimePeriods} x ${formatTime(profileData.defaultOTPeriodDuration, { showTenths: false })}` },
    { label: "Duración Descansos", value: `${formatTime(profileData.defaultBreakDuration, { showTenths: false })}` },
    { label: "Duración Descansos Pre-OT", value: `${formatTime(profileData.defaultPreOTBreakDuration, { showTenths: false })}` },
    { label: "Duración Timeouts", value: `${formatTime(profileData.defaultTimeoutDuration, { showTenths: false })}` },
    { label: "Jugadores en Cancha", value: profileData.playersPerTeamOnIce },
    { label: "Máx. Penalidades Concurrentes", value: profileData.maxConcurrentPenalties },
  ];

  return (
    <div className="space-y-4">
      <DialogDescription>
        Revisa la configuración a continuación. Si es correcta, haz clic en "Iniciar Partido".
      </DialogDescription>
       <div className="border rounded-lg max-h-[45vh] overflow-y-auto">
        <Table>
          <TableBody>
            {summaryItems.map(item => (
              <TableRow key={item.label}>
                <TableCell className="font-medium text-muted-foreground">{item.label}</TableCell>
                <TableCell className="text-right font-semibold">{item.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
       </div>
    </div>
  );
};


export function GameSetupDialog({ isOpen, onOpenChange, onGameReset }: GameSetupDialogProps) {
  const { state } = useGameState();
  const { toast } = useToast();
  
  const durationSettingsRef = useRef<DurationSettingsCardRef>(null);
  const penaltySettingsRef = useRef<PenaltySettingsCardRef>(null);
  
  const [isDurationDirty, setIsDurationDirty] = useState(false);
  const [isPenaltyDirty, setIsPenaltyDirty] = useState(false);
  const [view, setView] = useState<'editing' | 'confirming'>('editing');

  // Memoize the profile to ensure stability
  const selectedFTProfile = useMemo(() => {
    return state.config.formatAndTimingsProfiles.find(p => p.id === state.config.selectedFormatAndTimingsProfileId) 
      || state.config.formatAndTimingsProfiles[0] 
      || createDefaultFormatAndTimingsProfile();
  }, [state.config.formatAndTimingsProfiles, state.config.selectedFormatAndTimingsProfileId]);

  // Reset view to 'editing' whenever the dialog is opened
  useEffect(() => {
    if (isOpen) {
      setView('editing');
    }
  }, [isOpen]);

  const handleSaveChanges = (): boolean => {
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
        return true;
    } else {
        toast({
            title: "Error al Guardar",
            description: "No se pudieron guardar todos los cambios. Por favor revisa los valores.",
            variant: "destructive",
        });
        return false;
    }
  };
  
  const handleReviewAndContinue = () => {
    if (handleSaveChanges()) {
      setView('confirming');
    }
  };

  const handleStartGame = () => {
    onGameReset();
    onOpenChange(false);
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {view === 'editing' ? 'Configuración del Nuevo Partido' : 'Confirmar Configuración'}
          </DialogTitle>
          {view === 'editing' && (
            <DialogDescription>
              Ajusta la configuración del partido. Los cambios se guardarán en el perfil de formato y tiempos seleccionado. Al continuar, se reiniciará el estado del partido actual.
            </DialogDescription>
          )}
        </DialogHeader>
        
        {view === 'editing' ? (
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
        ) : (
           <div className="py-4">
            <ConfirmationView profileData={selectedFTProfile} onBack={() => setView('editing')} />
          </div>
        )}

        <DialogFooter>
          {view === 'editing' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleReviewAndContinue}>
                Revisar y Continuar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setView('editing')}>
                Volver a Editar
              </Button>
              <Button onClick={handleStartGame}>
                Iniciar Partido
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
