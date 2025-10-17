"use client";

import React, { useState, useEffect } from "react";
import { useGameState, formatTime } from "@/contexts/game-state-context";
import type { Team, PenaltyTypeDefinition } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Send, Siren } from "lucide-react";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";
import { useToast } from "@/hooks/use-toast";

interface AddPenaltyFormProps {
  homeTeamName: string;
  awayTeamName: string;
  penaltyTypes: PenaltyTypeDefinition[];
  defaultPenaltyTypeId: string | null;
  onPenaltySent: (team: Team, playerNumber: string, penaltyTypeId: string, gameTimeCs?: number) => void;
  preselectedTeam?: Team | null;
  showTimeInput?: boolean;
}

export function AddPenaltyForm({
  homeTeamName,
  awayTeamName,
  penaltyTypes,
  defaultPenaltyTypeId,
  onPenaltySent,
  preselectedTeam = null,
  showTimeInput = false,
}: AddPenaltyFormProps) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(preselectedTeam);
  const [playerNumber, setPlayerNumber] = useState('');
  const [penaltyTypeId, setPenaltyTypeId] = useState<string | null>(defaultPenaltyTypeId);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPenaltyTypeId(defaultPenaltyTypeId);
  }, [defaultPenaltyTypeId]);

  useEffect(() => {
    setSelectedTeam(preselectedTeam);
  }, [preselectedTeam]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) {
      toast({ title: "Error", description: "Debes seleccionar un equipo.", variant: "destructive" });
      return;
    }
    if (!playerNumber.trim()) {
      toast({ title: "Error", description: "El número del jugador es obligatorio.", variant: "destructive" });
      return;
    }
    if (!penaltyTypeId) {
      toast({ title: "Error", description: "Debes seleccionar un tipo de falta.", variant: "destructive" });
      return;
    }
    
    let gameTimeCs: number | undefined = undefined;
    if (showTimeInput) {
        const mins = parseInt(minutes, 10) || 0;
        const secs = parseInt(seconds, 10) || 0;
        if (mins < 0 || secs < 0 || secs >= 60) {
            toast({ title: "Tiempo Inválido", description: "Los minutos deben ser positivos y los segundos entre 0 y 59.", variant: "destructive"});
            return;
        }
        gameTimeCs = (mins * 60 + secs) * 100;
    }

    setIsSending(true);
    
    // Pass the data up to the parent component for dispatching.
    onPenaltySent(
      selectedTeam,
      playerNumber.trim(),
      penaltyTypeId,
      gameTimeCs
    );
    
    setIsSending(false);
    // The parent component will be responsible for closing the dialog
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label className="text-base">Equipo Sancionado</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button
            type="button"
            variant={selectedTeam === 'home' ? 'default' : 'outline'}
            onClick={() => setSelectedTeam('home')}
            className="h-12 text-base truncate"
            title={homeTeamName}
            disabled={!!preselectedTeam}
          >
            {homeTeamName}
          </Button>
          <Button
            type="button"
            variant={selectedTeam === 'away' ? 'default' : 'outline'}
            onClick={() => setSelectedTeam('away')}
            className="h-12 text-base truncate"
            title={awayTeamName}
            disabled={!!preselectedTeam}
          >
            {awayTeamName}
          </Button>
        </div>
      </div>
      
       <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="penalty-player-number"># Jugador</Label>
          <Input
            id="penalty-player-number"
            type="number"
            inputMode="numeric"
            value={playerNumber}
            onChange={(e) => setPlayerNumber(e.target.value)}
            placeholder="Ej: 99"
            className="h-12 text-lg"
            required
          />
        </div>
         <div>
          <Label htmlFor="penalty-type">Tipo de Falta</Label>
          <Select value={penaltyTypeId || ""} onValueChange={setPenaltyTypeId}>
              <SelectTrigger id="penalty-type" className="h-12 text-base">
                  <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                  {penaltyTypes.map(pt => (
                      <SelectItem key={pt.id} value={pt.id}>{pt.name} ({formatTime(pt.duration * 100)})</SelectItem>
                  ))}
                  {penaltyTypes.length === 0 && <SelectItem value="no-types" disabled>No hay tipos</SelectItem>}
              </SelectContent>
          </Select>
        </div>
      </div>

       {showTimeInput && (
        <div className="grid grid-cols-2 gap-4 items-end">
            <div>
                <Label>Tiempo de Juego (Ocurrido)</Label>
                 <div className="flex items-center gap-2 mt-1">
                    <Input
                        type="number"
                        inputMode="numeric"
                        value={minutes}
                        onChange={(e) => setMinutes(e.target.value)}
                        placeholder="MM"
                        className="w-16 h-12 text-lg text-center"
                    />
                    <span className="text-lg font-bold">:</span>
                    <Input
                        type="number"
                        inputMode="numeric"
                        value={seconds}
                        onChange={(e) => setSeconds(e.target.value)}
                        placeholder="SS"
                        className="w-16 h-12 text-lg text-center"
                    />
                </div>
            </div>
        </div>
      )}


      <DialogFooter className="pt-6">
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancelar</Button>
        </DialogClose>
        <Button type="submit" disabled={isSending} className="h-14 text-lg">
          {isSending ? <HockeyPuckSpinner className="h-6 w-6 mr-2" /> : <Siren className="mr-2 h-4 w-4" />}
          Añadir Penalidad
        </Button>
      </DialogFooter>
    </form>
  );
}