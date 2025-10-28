
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useGameState } from "@/contexts/game-state-context";
import { UploadCloud, FileJson, FileText, AlertTriangle, Loader2 } from "lucide-react";
import type { TeamData, PlayerData, PlayerType, CategoryData, Tournament } from "@/types";
import { safeUUID } from '@/lib/utils';
import { getSpecificDefaultLogoUrlForCsv } from './create-edit-team-dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';

interface ImportTeamsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  tournament: Tournament | null;
}

interface ParsedTeam extends Omit<TeamData, 'id' | 'players' | 'category'> {
    players: Omit<PlayerData, 'id'>[];
    categoryName: string;
}

type ParsingStatus = "idle" | "parsing" | "success" | "error";

export function ImportTeamsDialog({ isOpen, onOpenChange, tournament }: ImportTeamsDialogProps) {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [parsedTeams, setParsedTeams] = useState<ParsedTeam[]>([]);
  const [parsingStatus, setParsingStatus] = useState<ParsingStatus>("idle");
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [createMissingCategories, setCreateMissingCategories] = useState(true);

  const handleFileDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.dataTransfer.files) {
      setFiles(Array.from(event.dataTransfer.files));
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
    }
  };

  const processFiles = useCallback(() => {
    if (files.length === 0 || !tournament) return;

    setParsingStatus("parsing");
    setErrorDetails(null);
    setParsedTeams([]);

    const promises = files.map(file => new Promise<ParsedTeam[]>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                if (file.type === 'application/json' || file.name.endsWith('.json')) {
                    const jsonData = JSON.parse(content);
                    if (!Array.isArray(jsonData)) throw new Error("El archivo JSON debe contener un array de equipos.");
                    
                    const teams: ParsedTeam[] = jsonData.map((team: any) => ({
                        name: team.name || 'Sin Nombre',
                        subName: team.subName,
                        logoDataUrl: team.logoDataUrl,
                        categoryName: team.category || 'Sin Categoría',
                        players: (team.players || []).map((p: any) => ({
                            number: String(p.number || ''),
                            name: p.name || 'Sin Nombre',
                            type: p.type === 'goalkeeper' ? 'goalkeeper' : 'player',
                        }))
                    }));
                    resolve(teams);

                } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
                    const lines = content.split(/\r?\n/).filter(line => line.trim());
                    if (lines.length < 2) throw new Error("El archivo CSV está vacío o solo tiene cabecera.");
                    
                    const teamsMap = new Map<string, ParsedTeam>();
                    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                    const requiredHeaders = ['equipo', 'categoria', 'numero', 'nombre'];
                    if (!requiredHeaders.every(h => headers.includes(h))) {
                        throw new Error(`Cabeceras requeridas faltantes en CSV: ${requiredHeaders.join(', ')}`);
                    }

                    for (let i = 1; i < lines.length; i++) {
                        const values = lines[i].split(',').map(v => v.trim());
                        const row = headers.reduce((obj, header, index) => {
                            obj[header] = values[index];
                            return obj;
                        }, {} as Record<string, string>);

                        const teamKey = `${row.equipo || 's/n'}-${row.categoria || 's/c'}`;
                        if (!teamsMap.has(teamKey)) {
                            teamsMap.set(teamKey, {
                                name: row.equipo || 'Equipo Sin Nombre',
                                subName: row.subnombre,
                                logoDataUrl: getSpecificDefaultLogoUrlForCsv(row.equipo),
                                categoryName: row.categoria || 'Sin Categoría',
                                players: []
                            });
                        }

                        const playerType: PlayerType = (row.tipo?.toLowerCase() === 'arquero' || row.tipo?.toLowerCase() === 'goalkeeper') ? 'goalkeeper' : 'player';
                        teamsMap.get(teamKey)!.players.push({
                            number: row.numero || '',
                            name: row.nombre || 'Jugador Sin Nombre',
                            type: playerType,
                        });
                    }
                    resolve(Array.from(teamsMap.values()));
                } else {
                    throw new Error(`Tipo de archivo no soportado: ${file.name}`);
                }
            } catch (err) {
                reject(err instanceof Error ? err.message : String(err));
            }
        };
        reader.onerror = () => reject('Error al leer el archivo.');
        reader.readAsText(file);
    }));

    Promise.all(promises)
        .then(results => {
            setParsedTeams(results.flat());
            setParsingStatus("success");
        })
        .catch(err => {
            setErrorDetails(err);
            setParsingStatus("error");
        });

  }, [files, tournament]);

  useEffect(() => {
    if (files.length > 0) {
      processFiles();
    } else {
      setParsedTeams([]);
      setParsingStatus("idle");
    }
  }, [files, createMissingCategories, processFiles]);

  const handleImport = () => {
    if (!tournament) return;

    let newCategories: CategoryData[] = [];
    if (createMissingCategories) {
        const existingCategoryNames = new Set(tournament.categories.map(c => c.name.toLowerCase()));
        const missingCategories = new Set<string>();
        
        parsedTeams.forEach(team => {
            if (team.categoryName && !existingCategoryNames.has(team.categoryName.toLowerCase())) {
                missingCategories.add(team.categoryName);
            }
        });

        newCategories = Array.from(missingCategories).map(name => ({ id: safeUUID(), name }));
        if (newCategories.length > 0) {
            dispatch({ type: 'ADD_CATEGORIES_TO_TOURNAMENT', payload: { tournamentId: tournament.id, categories: newCategories } });
        }
    }

    const allCategories = [...tournament.categories, ...newCategories];
    let importedCount = 0;

    parsedTeams.forEach(parsedTeam => {
      const category = allCategories.find(c => c.name.toLowerCase() === parsedTeam.categoryName.toLowerCase());
      
      const teamPayload: TeamData = {
        id: safeUUID(),
        name: parsedTeam.name,
        subName: parsedTeam.subName,
        logoDataUrl: parsedTeam.logoDataUrl,
        category: category?.id || '', // Assign category ID or empty string if not found
        players: parsedTeam.players.map(p => ({ ...p, id: safeUUID() })),
      };

      dispatch({ type: 'ADD_TEAM_TO_TOURNAMENT', payload: { tournamentId: tournament.id, team: teamPayload } });
      importedCount++;
    });

    toast({
        title: "Importación Completa",
        description: `Se importaron ${importedCount} equipos. ${newCategories.length > 0 ? `Se crearon ${newCategories.length} nuevas categorías.` : ''}`
    });
    onOpenChange(false);
  };
  
  useEffect(() => {
    if(!isOpen) {
      setFiles([]);
      setParsedTeams([]);
      setParsingStatus('idle');
      setErrorDetails(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Equipos</DialogTitle>
          <DialogDescription>
            Arrastra o selecciona archivos JSON o CSV para importar equipos al torneo "{tournament?.name}".
          </DialogDescription>
        </DialogHeader>

        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className="flex-grow flex flex-col gap-4 border-2 border-dashed rounded-lg p-4 text-center"
        >
          {files.length === 0 ? (
            <div className="m-auto">
              <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Arrastra archivos aquí o</p>
              <Button type="button" variant="outline" className="mt-2" onClick={() => document.getElementById('file-upload')?.click()}>
                Selecciona Archivos
              </Button>
              <input type="file" id="file-upload" multiple className="hidden" onChange={handleFileSelect} accept=".json,.csv" />
            </div>
          ) : (
             <div className="flex-grow flex flex-col">
                <h3 className="font-semibold text-left mb-2">Archivos Seleccionados:</h3>
                <div className="flex-grow space-y-2 overflow-y-auto pr-2">
                    {files.map(file => (
                        <div key={file.name} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded-md">
                            {file.type === 'application/json' ? <FileJson className="h-5 w-5 text-amber-500"/> : <FileText className="h-5 w-5 text-green-500" />}
                            <span className="truncate flex-grow text-left">{file.name}</span>
                            <span className="text-muted-foreground text-xs shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                    ))}
                </div>
                 <Button type="button" variant="link" size="sm" className="mt-2" onClick={() => setFiles([])}>Limpiar selección</Button>
             </div>
          )}
        </div>

        {parsingStatus === "parsing" && <div className="flex items-center justify-center gap-2 text-muted-foreground"><Loader2 className="animate-spin h-5 w-5"/>Procesando archivos...</div>}
        {parsingStatus === "error" && <div className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Error: {errorDetails}</div>}

        {parsingStatus === "success" && (
            <div className="space-y-4">
                 <div className="flex items-center space-x-2">
                    <Checkbox id="create-categories" checked={createMissingCategories} onCheckedChange={(checked) => setCreateMissingCategories(Boolean(checked))} />
                    <Label htmlFor="create-categories" className="text-sm font-normal">Crear categorías faltantes automáticamente</Label>
                </div>
                <h3 className="font-semibold">Vista Previa de Equipos ({parsedTeams.length}):</h3>
                <ScrollArea className="h-40 border rounded-md p-2">
                    <div className="space-y-1">
                        {parsedTeams.map((team, i) => (
                            <div key={i} className="text-sm text-muted-foreground">{team.name} ({team.categoryName}) - {team.players.length} jugadores</div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleImport} disabled={parsedTeams.length === 0 || parsingStatus !== 'success'}>
            Importar {parsedTeams.length} Equipo(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
