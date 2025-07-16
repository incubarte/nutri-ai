
"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState, type FormatAndTimingsProfileData, type PenaltyTypeDefinition, formatTime } from "@/contexts/game-state-context";
import { ControlCardWrapper } from "@/components/controls/control-card-wrapper";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Edit3, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { safeUUID } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { cn } from "@/lib/utils";
import { Checkbox } from "../ui/checkbox";

export interface PenaltyTypesCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
  setValues: (values: Partial<FormatAndTimingsProfileData>) => void;
}

interface PenaltyTypesCardProps {
  onDirtyChange: (isDirty: boolean) => void;
  initialValues: Partial<FormatAndTimingsProfileData>;
}

export const PenaltyTypesCard = forwardRef<PenaltyTypesCardRef, PenaltyTypesCardProps>((props, ref) => {
  const { dispatch } = useGameState();
  const { onDirtyChange, initialValues } = props;
  const { toast } = useToast();
  
  const [localPenaltyTypes, setLocalPenaltyTypes] = useState<PenaltyTypeDefinition[]>(initialValues.penaltyTypes || []);
  const [localDefaultPenaltyId, setLocalDefaultPenaltyId] = useState<string | null>(initialValues.defaultPenaltyTypeId || null);
  const [editingPenalty, setEditingPenalty] = useState<PenaltyTypeDefinition | null>(null);
  
  const [enableMaxPenalties, setEnableMaxPenalties] = useState(initialValues.enableMaxPenaltiesLimit || false);
  const [maxPenalties, setMaxPenalties] = useState(String(initialValues.maxPenaltiesPerPlayer || ''));
  
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);
  
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const setValuesFromProfile = (values: Partial<FormatAndTimingsProfileData>) => {
    setLocalPenaltyTypes(values.penaltyTypes || []);
    setLocalDefaultPenaltyId(values.defaultPenaltyTypeId || null);
    setEnableMaxPenalties(values.enableMaxPenaltiesLimit || false);
    setMaxPenalties(String(values.maxPenaltiesPerPlayer || ''));
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
      dispatch({
        type: "UPDATE_SELECTED_FT_PROFILE_DATA",
        payload: {
          penaltyTypes: localPenaltyTypes,
          defaultPenaltyTypeId: localDefaultPenaltyId,
          enableMaxPenaltiesLimit: enableMaxPenalties,
          maxPenaltiesPerPlayer: parseInt(maxPenalties, 10) || 3,
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
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
    setDraggedItemId(id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetId) return;

    const draggedIndex = localPenaltyTypes.findIndex(p => p.id === draggedItemId);
    const targetIndex = localPenaltyTypes.findIndex(p => p.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const newPenaltyTypes = [...localPenaltyTypes];
    const [draggedItem] = newPenaltyTypes.splice(draggedIndex, 1);
    newPenaltyTypes.splice(targetIndex, 0, draggedItem);
    
    setLocalPenaltyTypes(newPenaltyTypes);
    markDirty();
    setDraggedItemId(null);
  };

  const handleAddNewPenalty = () => {
    setEditingPenalty({ id: safeUUID(), name: '', duration: 120, type: 'minor' });
  };
  
  const handleEditPenalty = (penalty: PenaltyTypeDefinition) => {
    setEditingPenalty(penalty);
  };

  const handleDeletePenalty = (id: string) => {
    const newPenalties = localPenaltyTypes.filter(p => p.id !== id);
    setLocalPenaltyTypes(newPenalties);
    if (localDefaultPenaltyId === id) {
      setLocalDefaultPenaltyId(newPenalties[0]?.id || null);
    }
    markDirty();
    toast({ title: "Tipo de Penalidad Eliminado", description: "El tipo de penalidad ha sido eliminado de la lista. Guarda los cambios.", variant: "destructive"});
  };

  const handleSavePenalty = (penaltyToSave: PenaltyTypeDefinition) => {
    const isNew = !localPenaltyTypes.some(p => p.id === penaltyToSave.id);
    if (isNew) {
      setLocalPenaltyTypes([...localPenaltyTypes, penaltyToSave]);
    } else {
      setLocalPenaltyTypes(localPenaltyTypes.map(p => p.id === penaltyToSave.id ? penaltyToSave : p));
    }
    setEditingPenalty(null);
    markDirty();
  };

  return (
    <ControlCardWrapper title="Configuración Avanzada de Penalidades">
      <div className="space-y-4">
        <div>
          <Label htmlFor="defaultPenaltyType">Falta por Defecto</Label>
          <Select 
            value={localDefaultPenaltyId || ""}
            onValueChange={val => { setLocalDefaultPenaltyId(val); markDirty(); }}
            disabled={localPenaltyTypes.length === 0}
          >
            <SelectTrigger id="defaultPenaltyType">
              <SelectValue placeholder="Seleccionar falta por defecto..." />
            </SelectTrigger>
            <SelectContent>
              {localPenaltyTypes.length > 0 ? (
                localPenaltyTypes.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({formatTime(p.duration * 100)})</SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">No hay tipos definidos</div>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1.5">
            Esta será la penalidad preseleccionada en el tablero de controles.
          </p>
        </div>

        <div className="space-y-2">
            <Label>Lista de Tipos de Faltas (Arrastra para reordenar)</Label>
            <div className="border rounded-md p-2 space-y-2 max-h-60 overflow-y-auto">
              {localPenaltyTypes.length > 0 ? (
                localPenaltyTypes.map(p => (
                  <div 
                    key={p.id} 
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md"
                    draggable
                    onDragStart={(e) => handleDragStart(e, p.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, p.id)}
                  >
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(p.duration * 100)} - {p.type === 'minor' ? 'Regular' : 'Mala Conducta'}{p.isBenchPenalty ? ' (Banco)' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditPenalty(p)}>
                         <Edit3 className="h-4 w-4" />
                       </Button>
                       <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeletePenalty(p.id)}>
                         <Trash2 className="h-4 w-4" />
                       </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center text-muted-foreground py-4">No hay tipos de penalidades definidos.</p>
              )}
            </div>
            <Button onClick={handleAddNewPenalty} variant="outline" className="mt-2 w-full">
                <Plus className="mr-2 h-4 w-4" /> Añadir Nuevo Tipo de Penalidad
            </Button>
        </div>

        <Separator />

        <div>
          <Label>Límites de Penalidades por Jugador</Label>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
              <Label htmlFor="enableMaxPenalties" className="font-normal">Habilitar límite de cantidad de penalidades</Label>
              <Switch id="enableMaxPenalties" checked={enableMaxPenalties} onCheckedChange={(c) => { setEnableMaxPenalties(c); markDirty(); }} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
              <Label htmlFor="maxPenaltiesPerPlayer" className="font-normal">Cantidad máxima de penalidades</Label>
              <Input id="maxPenaltiesPerPlayer" type="number" value={maxPenalties} onChange={(e) => { setMaxPenalties(e.target.value); markDirty(); }} className="w-20 h-8" disabled={!enableMaxPenalties} />
            </div>
          </div>
        </div>
      </div>
      
      {editingPenalty && (
        <EditPenaltyDialog
          penalty={editingPenalty}
          isOpen={!!editingPenalty}
          onOpenChange={(isOpen) => !isOpen && setEditingPenalty(null)}
          onSave={handleSavePenalty}
        />
      )}
    </ControlCardWrapper>
  );
});

PenaltyTypesCard.displayName = "PenaltyTypesCard";


function EditPenaltyDialog({ penalty, isOpen, onOpenChange, onSave }: { penalty: PenaltyTypeDefinition, isOpen: boolean, onOpenChange: (open: boolean) => void, onSave: (penalty: PenaltyTypeDefinition) => void }) {
  const [name, setName] = useState(penalty.name);
  const [duration, setDuration] = useState(String(penalty.duration));
  const [type, setType] = useState<"minor" | "misconduct">(penalty.type);
  const [isBenchPenalty, setIsBenchPenalty] = useState(penalty.isBenchPenalty || false);

  const handleSubmit = () => {
    const durationNum = parseInt(duration, 10);
    if (!name.trim() || isNaN(durationNum) || durationNum <= 0) {
      // Basic validation
      return;
    }
    onSave({ ...penalty, name: name.trim(), duration: durationNum, type, isBenchPenalty });
  };
  
  return (
     <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{penalty.name ? "Editar" : "Añadir"} Tipo de Penalidad</DialogTitle>
            <DialogDescription>Define los detalles de este tipo de falta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
              <div>
                  <Label htmlFor="penaltyName">Nombre</Label>
                  <Input id="penaltyName" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Menor, Doble Menor"/>
              </div>
              <div>
                  <Label htmlFor="penaltyDuration">Duración (en segundos)</Label>
                  <Input id="penaltyDuration" type="number" value={duration} onChange={e => setDuration(e.target.value)} placeholder="Ej: 120"/>
              </div>
              <div>
                  <Label htmlFor="penaltyType">Tipo</Label>
                  <Select value={type} onValueChange={(v: "minor" | "misconduct") => setType(v)}>
                      <SelectTrigger id="penaltyType">
                          <SelectValue placeholder="Seleccionar tipo..."/>
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="minor">Regular (Saca jugador)</SelectItem>
                          <SelectItem value="misconduct">Mala Conducta (No saca jugador)</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="isBenchPenalty" checked={isBenchPenalty} onCheckedChange={c => setIsBenchPenalty(!!c)} />
                <Label htmlFor="isBenchPenalty" className="font-normal">Es una Penalidad de Banco</Label>
              </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSubmit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
