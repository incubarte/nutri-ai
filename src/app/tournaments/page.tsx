
"use client";

import React, { useState, useEffect } from "react";
import { useGameState } from "@/contexts/game-state-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trophy, PlusCircle, Edit, Trash2, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Tournament } from "@/types";
import { cn } from "@/lib/utils";

const statusMap: Record<Tournament['status'], { text: string; className: string }> = {
  active: { text: "Activo", className: "bg-green-600 hover:bg-green-700" },
  inactive: { text: "Inactivo", className: "bg-yellow-600 hover:bg-yellow-700 text-black" },
  finished: { text: "Finalizado", className: "bg-gray-500 hover:bg-gray-600" },
};

function CreateEditTournamentDialog({
  isOpen,
  onOpenChange,
  tournamentToEdit,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  tournamentToEdit?: Tournament | null;
}) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<Tournament['status']>("inactive");

  const isEditing = !!tournamentToEdit;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && tournamentToEdit) {
        setName(tournamentToEdit.name);
        setStatus(tournamentToEdit.status);
      } else {
        setName("");
        setStatus("inactive");
      }
    }
  }, [isOpen, tournamentToEdit, isEditing]);

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({
        title: "Nombre Requerido",
        description: "El nombre del torneo no puede estar vacío.",
        variant: "destructive",
      });
      return;
    }

    const isDuplicate = state.config.tournaments.some(
      (t) => t.id !== tournamentToEdit?.id && t.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (isDuplicate) {
      toast({
        title: "Torneo Duplicado",
        description: `Ya existe un torneo con el nombre "${trimmedName}".`,
        variant: "destructive",
      });
      return;
    }

    if (isEditing && tournamentToEdit) {
      dispatch({
        type: "UPDATE_TOURNAMENT",
        payload: { id: tournamentToEdit.id, name: trimmedName, status },
      });
      toast({ title: "Torneo Actualizado", description: `"${trimmedName}" ha sido actualizado.` });
    } else {
      dispatch({ type: "ADD_TOURNAMENT", payload: { name: trimmedName, status } });
      toast({ title: "Torneo Creado", description: `"${trimmedName}" ha sido creado.` });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Torneo" : "Crear Nuevo Torneo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Nombre
            </Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Estado
            </Label>
            <Select value={status} onValueChange={(value) => setStatus(value as Tournament['status'])}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Seleccionar estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inactive">Inactivo</SelectItem>
                <SelectItem value="active">Activo</SelectItem>
                <SelectItem value="finished">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit}>
            {isEditing ? "Guardar Cambios" : "Crear Torneo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TournamentsPage() {
  const { state, dispatch } = useGameState();
  const [isCreateEditDialogOpen, setIsCreateEditDialogOpen] = useState(false);
  const [tournamentToEdit, setTournamentToEdit] = useState<Tournament | null>(null);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);

  const handleEdit = (tournament: Tournament) => {
    setTournamentToEdit(tournament);
    setIsCreateEditDialogOpen(true);
  };

  const handleDelete = (tournament: Tournament) => {
    setTournamentToDelete(tournament);
  };

  const confirmDelete = () => {
    if (tournamentToDelete) {
      dispatch({ type: "DELETE_TOURNAMENT", payload: { id: tournamentToDelete.id } });
      toast({
        title: "Torneo Eliminado",
        description: `El torneo "${tournamentToDelete.name}" ha sido eliminado.`,
        variant: "destructive",
      });
      setTournamentToDelete(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 py-10">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-primary-foreground">Gestión de Torneos</h1>
        </div>
        <Button onClick={() => { setTournamentToEdit(null); setIsCreateEditDialogOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" /> Crear Nuevo Torneo
        </Button>
      </div>

      <div className="space-y-4">
        {state.config.tournaments.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No has creado ningún torneo todavía.</p>
            <p className="text-sm text-muted-foreground">¡Usa el botón de arriba para crear el primero!</p>
          </div>
        ) : (
          state.config.tournaments.map((tournament) => (
            <Card key={tournament.id}>
              <CardContent className="p-4 flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="font-semibold text-lg text-card-foreground">{tournament.name}</span>
                   <Badge className={cn("w-fit", statusMap[tournament.status].className)}>
                    {statusMap[tournament.status].text}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => handleEdit(tournament)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(tournament)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <CreateEditTournamentDialog
        isOpen={isCreateEditDialogOpen}
        onOpenChange={setIsCreateEditDialogOpen}
        tournamentToEdit={tournamentToEdit}
      />

      {tournamentToDelete && (
        <AlertDialog open={!!tournamentToDelete} onOpenChange={() => setTournamentToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres eliminar el torneo "{tournamentToDelete.name}"? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90">
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

