
"use client";

import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { useGameState, type CategoryData } from "@/contexts/game-state-context";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Edit3, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface CategorySettingsCardRef {
  handleSave: () => boolean;
  handleDiscard: () => void;
  getIsDirty: () => boolean;
}

interface CategorySettingsCardProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export const CategorySettingsCard = forwardRef<CategorySettingsCardRef, CategorySettingsCardProps>((props, ref) => {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { onDirtyChange } = props;

  const [localCategoriesString, setLocalCategoriesString] = useState(
    state.config.availableCategories.map(c => c.name).join(", ")
  );
  const [isDirtyLocal, setIsDirtyLocal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    onDirtyChange(isDirtyLocal);
  }, [isDirtyLocal, onDirtyChange]);

  useEffect(() => {
     if (!isDirtyLocal) {
      setLocalCategoriesString(state.config.availableCategories.map(c => c.name).join(", "));
    }
  }, [state.config.availableCategories, isDirtyLocal]);

  const markDirty = () => setIsDirtyLocal(true);

  useImperativeHandle(ref, () => ({
    handleSave: () => {
      if (!isDirtyLocal) return true;

      const categoryNames = localCategoriesString
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);
      
      const uniqueCategoryNames = Array.from(new Set(categoryNames.map(name => name.toLowerCase())));
      
      if (uniqueCategoryNames.length !== categoryNames.length) {
         toast({
            title: "Error en Categorías",
            description: "Los nombres de las categorías deben ser únicos (ignorando mayúsculas/minúsculas y después de eliminar duplicados exactos).",
            variant: "destructive",
        });
        return false; 
      }
      
      const finalCategories: CategoryData[] = Array.from(new Set(categoryNames)) 
          .map(name => ({ id: name, name })); 

      dispatch({ type: "SET_AVAILABLE_CATEGORIES", payload: finalCategories });
      setIsDirtyLocal(false);
      setIsEditing(false); // Exit editing mode after save
      return true; 
    },
    handleDiscard: () => {
      setLocalCategoriesString(state.config.availableCategories.map(c => c.name).join(", "));
      setIsDirtyLocal(false);
      setIsEditing(false); // Exit editing mode after discard
    },
    getIsDirty: () => isDirtyLocal,
  }));

  const handleEditToggle = () => {
    if (isEditing && isDirtyLocal) {
        setLocalCategoriesString(state.config.availableCategories.map(c => c.name).join(", "));
        setIsDirtyLocal(false);
    }
    setIsEditing(!isEditing);
  };


  return (
    <Card className="bg-card shadow-md">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-xl text-primary-foreground">Configuración de Categorías</CardTitle>
        <Button variant="ghost" size="icon" onClick={handleEditToggle} className="text-primary-foreground hover:text-accent">
          {isEditing ? <XCircle className="h-5 w-5" /> : <Edit3 className="h-5 w-5" />}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="grid grid-cols-[auto_1fr] items-center gap-x-4">
            <Label htmlFor="categoriesInput" className="text-base font-medium whitespace-nowrap">
              Nombres de Categorías
            </Label>
            <Input
              id="categoriesInput"
              type="text"
              placeholder="Ej: A, B, C (separadas por coma)"
              value={localCategoriesString}
              onChange={(e) => {
                setLocalCategoriesString(e.target.value);
                markDirty();
              }}
              disabled={!isEditing}
              className={cn(!isEditing && "bg-muted/50 border-muted/50 cursor-not-allowed")}
            />
          </div>
          <p className="text-xs text-muted-foreground pl-1">
            Estas categorías estarán disponibles al crear o editar equipos.
            Los nombres deben ser únicos (se ignoran mayúsculas/minúsculas para la unicidad).
            Haga clic en el lápiz para editar.
          </p>
        </div>
      </CardContent>
    </Card>
  );
});

CategorySettingsCard.displayName = "CategorySettingsCard";
