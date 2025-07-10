
"use client";

import { useState } from 'react';
import type { Team } from '@/types';
import { useGameState } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Goal, Send, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendRemoteCommand } from '../actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

function AddGoalForm({ homeTeamName, awayTeamName, onGoalSent }: { homeTeamName: string; awayTeamName: string; onGoalSent: () => void }) {
    const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
    const [scorerNumber, setScorerNumber] = useState('');
    const [assistNumber, setAssistNumber] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { toast } = useToast();
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedTeam) {
        toast({ title: "Error", description: "Debes seleccionar un equipo.", variant: "destructive" });
        return;
      }
      if (!scorerNumber.trim()) {
        toast({ title: "Error", description: "El número del goleador es obligatorio.", variant: "destructive" });
        return;
      }
  
      setIsSending(true);
      const result = await sendRemoteCommand({
        type: 'ADD_GOAL',
        payload: {
          team: selectedTeam,
          scorerNumber: scorerNumber.trim(),
          assistNumber: assistNumber.trim() || undefined,
        }
      });
      setIsSending(false);
  
      if (result.success) {
        toast({ title: "Comando Enviado", description: "El gol ha sido enviado al operador principal." });
        onGoalSent(); // Close dialog
      } else {
        toast({ title: "Error al Enviar", description: result.message, variant: "destructive" });
      }
    };
  
    return (
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label className="text-base">Equipo que Anotó</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <Button
              type="button"
              variant={selectedTeam === 'home' ? 'default' : 'outline'}
              onClick={() => setSelectedTeam('home')}
              className="h-12 text-base"
            >
              {homeTeamName}
            </Button>
            <Button
              type="button"
              variant={selectedTeam === 'away' ? 'default' : 'outline'}
              onClick={() => setSelectedTeam('away')}
              className="h-12 text-base"
            >
              {awayTeamName}
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="scorer-number"># Goleador</Label>
            <Input
              id="scorer-number"
              type="number"
              inputMode="numeric"
              value={scorerNumber}
              onChange={(e) => setScorerNumber(e.target.value)}
              placeholder="Ej: 99"
              className="h-12 text-lg"
              required
            />
          </div>
          <div>
            <Label htmlFor="assist-number"># Asistente</Label>
            <Input
              id="assist-number"
              type="number"
              inputMode="numeric"
              value={assistNumber}
              onChange={(e) => setAssistNumber(e.target.value)}
              placeholder="(Opcional)"
              className="h-12 text-lg"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="submit" disabled={isSending}>
            {isSending ? <LoadingSpinner className="mr-2" /> : <Send className="mr-2 h-4 w-4" />}
            Enviar Gol
          </Button>
        </DialogFooter>
      </form>
    );
  }


export default function MobileControlsPage() {
  const { state, isLoading } = useGameState();
  const [isAddGoalDialogOpen, setIsAddGoalDialogOpen] = useState(false);

  if (isLoading || !state.live || !state.config) {
    return (
      <div className="flex flex-col h-screen w-screen -m-4 items-center justify-center text-center">
        <LoadingSpinner className="h-12 w-12 text-primary" />
        <p className="text-muted-foreground mt-4">Cargando control remoto...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-8 pt-8">
      <div className="text-center space-y-2">
        <Users className="mx-auto h-12 w-12 text-primary" />
        <h1 className="text-3xl font-bold text-primary-foreground">Control Remoto</h1>
        <p className="text-muted-foreground">
          Acciones rápidas para el operador auxiliar.
        </p>
      </div>
      <Card>
        <CardContent className="p-6">
          <Button
            className="w-full h-24 text-2xl font-bold"
            onClick={() => setIsAddGoalDialogOpen(true)}
          >
            <Goal className="mr-4 h-8 w-8" />
            Añadir Gol
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isAddGoalDialogOpen} onOpenChange={setIsAddGoalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar un Nuevo Gol</DialogTitle>
            <DialogDescription>
              Selecciona el equipo y los números de los jugadores. El comando será enviado al operador principal.
            </DialogDescription>
          </DialogHeader>
          <AddGoalForm 
            homeTeamName={state.live.homeTeamName}
            awayTeamName={state.live.awayTeamName}
            onGoalSent={() => setIsAddGoalDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
