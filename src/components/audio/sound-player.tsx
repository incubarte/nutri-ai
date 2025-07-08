
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useGameState, DEFAULT_SOUND_PATH, DEFAULT_PENALTY_BEEP_PATH } from '@/contexts/game-state-context';
import { useToast } from '@/hooks/use-toast';

export function SoundPlayer() {
  const { state, isLoading } = useGameState();
  const { toast } = useToast();

  // --- Hooks Section ---
  // All hooks must be called unconditionally at the top to respect the Rules of Hooks.
  const lastPlayedHornTriggerRef = useRef<number>(0);
  const hornAudioRef = useRef<HTMLAudioElement | null>(null);

  const lastPlayedBeepTriggerRef = useRef<number>(0);
  const penaltyAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const didMountRef = useRef(false); // Ref to track initial mount

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // --- Early Return Guard ---
  // It's safe to return early *after* all hooks have been called.
  if (isLoading || !state.config || !state.live) {
    return null;
  }
  
  const { config, live } = state;

  // This single useEffect handles both sounds and mounting logic.
  useEffect(() => {
    // On the first render cycle (mount), we don't play sounds.
    // We sync the refs to the current state and set didMount to true.
    if (!didMountRef.current) {
        lastPlayedHornTriggerRef.current = live.playHornTrigger;
        lastPlayedBeepTriggerRef.current = live.playPenaltyBeepTrigger;
        didMountRef.current = true;
        return;
    }

    // Horn sound effect logic for subsequent renders
    if (live.playHornTrigger > lastPlayedHornTriggerRef.current) {
      lastPlayedHornTriggerRef.current = live.playHornTrigger;

      if (config.playSoundAtPeriodEnd && hornAudioRef.current) {
        hornAudioRef.current.currentTime = 0;
        hornAudioRef.current.play().catch(error => {
          console.warn("Playback prevented for horn sound:", error);
          toast({
            title: "Error de Sonido de Bocina",
            description: "El navegador impidió la reproducción automática del sonido.",
            variant: "destructive"
          });
        });
      }
    }

    // Penalty beep sound effect logic for subsequent renders
    if (live.playPenaltyBeepTrigger > lastPlayedBeepTriggerRef.current) {
      lastPlayedBeepTriggerRef.current = live.playPenaltyBeepTrigger;
      
      if (config.enablePenaltyCountdownSound && penaltyAudioRef.current) {
        penaltyAudioRef.current.currentTime = 0;
        penaltyAudioRef.current.play().catch(error => {
          console.warn("Playback prevented for penalty beep:", error);
          toast({
            title: "Error de Sonido de Beep",
            description: "El navegador impidió la reproducción automática del sonido.",
            variant: "destructive"
          });
        });
      }
    }
  }, [live.playHornTrigger, live.playPenaltyBeepTrigger, config.playSoundAtPeriodEnd, config.enablePenaltyCountdownSound, toast]);

  const hornSoundSrc = config.customHornSoundDataUrl || DEFAULT_SOUND_PATH;
  const penaltyBeepSoundSrc = config.customPenaltyBeepSoundDataUrl || DEFAULT_PENALTY_BEEP_PATH;

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>, soundName: string) => {
    const error = e.currentTarget.error;
    if (!error) return;
    
    let errorMessage = `Código de error: ${error.code}.`;
    switch (error.code) {
      case error.MEDIA_ERR_ABORTED:
        errorMessage = 'La carga de audio fue abortada.';
        break;
      case error.MEDIA_ERR_NETWORK:
        errorMessage = 'Ocurrió un error de red al cargar el audio.';
        break;
      case error.MEDIA_ERR_DECODE:
        errorMessage = 'El archivo de audio está corrupto o no es soportado.';
        break;
      case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMessage = 'No se encontró o no se soporta el archivo de audio. Verifica que exista en la carpeta /public.';
        break;
      default:
        errorMessage = 'Ocurrió un error desconocido al cargar el audio.';
        break;
    }

    console.error(`Error de Audio (${soundName}):`, error.message, e.currentTarget.src);
    toast({
        title: `Error de Sonido (${soundName})`,
        description: errorMessage,
        variant: "destructive"
    });
  };

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <audio 
        ref={hornAudioRef} 
        src={hornSoundSrc} 
        preload="auto"
        onError={(e) => handleAudioError(e, 'Bocina')} 
      />
      <audio 
        ref={penaltyAudioRef} 
        src={penaltyBeepSoundSrc} 
        preload="auto" 
        onError={(e) => handleAudioError(e, 'Beep Penalidad')}
      />
    </>
  );
}
