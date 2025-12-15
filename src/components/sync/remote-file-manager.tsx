"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, RefreshCw, ChevronRight, ChevronDown, Folder, File, AlertCircle } from "lucide-react";
import { useGameState } from "@/contexts/game-state-context";

interface RemoteFile {
    name: string;
    id: string;
    updated_at: string;
    created_at: string;
    metadata: {
        size: number;
        mimetype: string;
    };
}

interface FolderStructure {
    [folderPath: string]: RemoteFile[];
}

export function RemoteFileManager() {
    const { state } = useGameState();
    const [files, setFiles] = useState<RemoteFile[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { toast } = useToast();

    // Helper to extract match info from file path
    const extractMatchInfo = (filePath: string) => {
        const summaryMatch = filePath.match(/tournaments\/([^/]+)\/summaries\/([^/]+)\.json/);
        if (!summaryMatch) return null;

        const [, tournamentId, matchId] = summaryMatch;
        const tournaments = state?.config?.tournaments || [];

        // Find the tournament
        let tournament = tournaments.find(t => t.id === tournamentId);

        // If tournament not found, search all tournaments for the match
        if (!tournament) {
            for (const t of tournaments) {
                if (t.matches?.find(m => m.id === matchId)) {
                    tournament = t;
                    break;
                }
            }
        }

        // If still no tournament or tournament doesn't have matches loaded
        if (!tournament || !tournament.matches || tournament.matches.length === 0) {
            const tournamentExists = tournaments.find(t => t.id === tournamentId);
            if (tournamentExists) {
                return { isOutsideFixture: true, tournamentId, matchId };
            }
            return null;
        }

        // Find the match
        const match = tournament.matches.find(m => m.id === matchId);
        if (!match) {
            return { isOutsideFixture: true, tournamentId, matchId };
        }

        return { isOutsideFixture: false, tournamentId, matchId };
    };

    // Detect summaries outside fixture
    const summariesOutsideFixture = useMemo(() => {
        return files.filter(file => {
            const matchInfo = extractMatchInfo(file.name);
            return matchInfo?.isOutsideFixture === true;
        });
    }, [files, state?.config?.tournaments]);

    const loadFiles = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/sync/remote-files');
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load files');
            }

            setFiles(data.files);
            toast({
                title: "✅ Archivos cargados",
                description: `${data.totalFiles} archivo(s) encontrados en Supabase`,
            });
        } catch (error) {
            toast({
                title: "❌ Error",
                description: error instanceof Error ? error.message : 'Error al cargar archivos',
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    // No auto-load on mount - user must click button

    // Organize files by folder
    const folderStructure = useMemo(() => {
        const structure: FolderStructure = {};

        files.forEach(file => {
            const lastSlashIndex = file.name.lastIndexOf('/');
            const folder = lastSlashIndex > 0 ? file.name.substring(0, lastSlashIndex) : '/';

            if (!structure[folder]) {
                structure[folder] = [];
            }
            structure[folder].push(file);
        });

        return structure;
    }, [files]);

    const sortedFolders = useMemo(() => {
        return Object.keys(folderStructure).sort();
    }, [folderStructure]);

    const toggleFileSelection = (filePath: string) => {
        const newSelected = new Set(selectedFiles);
        if (newSelected.has(filePath)) {
            newSelected.delete(filePath);
        } else {
            newSelected.add(filePath);
        }
        setSelectedFiles(newSelected);
    };

    const isFolderFullySelected = (folder: string) => {
        const filesInFolder = folderStructure[folder];
        return filesInFolder.every(file => selectedFiles.has(file.name));
    };

    const isFolderPartiallySelected = (folder: string) => {
        const filesInFolder = folderStructure[folder];
        const selectedCount = filesInFolder.filter(file => selectedFiles.has(file.name)).length;
        return selectedCount > 0 && selectedCount < filesInFolder.length;
    };

    const toggleFolder = (folder: string) => {
        const filesInFolder = folderStructure[folder];
        const shouldSelect = !isFolderFullySelected(folder);

        const newSelected = new Set(selectedFiles);
        filesInFolder.forEach(file => {
            if (shouldSelect) {
                newSelected.add(file.name);
            } else {
                newSelected.delete(file.name);
            }
        });
        setSelectedFiles(newSelected);
    };

    const toggleExpanded = (folder: string) => {
        const newExpanded = new Set(expandedFolders);
        if (newExpanded.has(folder)) {
            newExpanded.delete(folder);
        } else {
            newExpanded.add(folder);
        }
        setExpandedFolders(newExpanded);
    };

    const handleSelectOutsideFixture = () => {
        const newSelected = new Set(selectedFiles);
        summariesOutsideFixture.forEach(file => {
            newSelected.add(file.name);
        });
        setSelectedFiles(newSelected);

        toast({
            title: "✅ Summaries seleccionados",
            description: `${summariesOutsideFixture.length} summaries fuera de fixture seleccionados`,
        });
    };

    const handleDeleteSelected = async () => {
        if (selectedFiles.size === 0) {
            toast({
                title: "⚠️ Sin selección",
                description: "Selecciona al menos un archivo para borrar",
                variant: "destructive",
            });
            return;
        }

        if (!confirm(`¿Estás seguro de borrar ${selectedFiles.size} archivo(s) de Supabase? Esta acción marcará los archivos como borrados en el manifest.`)) {
            return;
        }

        setDeleting(true);
        try {
            const response = await fetch('/api/sync/remote-files', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filePaths: Array.from(selectedFiles)
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to delete files');
            }

            toast({
                title: "✅ Archivos borrados",
                description: `${data.deleted.length} archivo(s) borrados exitosamente${data.errors.length > 0 ? `, ${data.errors.length} fallaron` : ''}`,
            });

            // Clear selection and reload
            setSelectedFiles(new Set());
            await loadFiles();

        } catch (error) {
            toast({
                title: "❌ Error",
                description: error instanceof Error ? error.message : 'Error al borrar archivos',
                variant: "destructive",
            });
        } finally {
            setDeleting(false);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleString('es-AR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            Archivos Remotos (Supabase)
                            {summariesOutsideFixture.length > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md">
                                    <AlertCircle className="h-3 w-3" />
                                    {summariesOutsideFixture.length} fuera de fixture
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription>
                            Administra archivos en el storage remoto. Los archivos borrados se marcan en el manifest para sincronizar el borrado.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={loadFiles}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Cargando...
                                </>
                            ) : (
                                <>
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    {files.length === 0 ? 'Cargar Archivos' : 'Recargar'}
                                </>
                            )}
                        </Button>
                        {summariesOutsideFixture.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleSelectOutsideFixture}
                                className="border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                            >
                                <AlertCircle className="h-4 w-4 mr-2" />
                                Seleccionar Fuera de Fixture
                            </Button>
                        )}
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteSelected}
                            disabled={selectedFiles.size === 0 || deleting}
                        >
                            {deleting ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Borrar ({selectedFiles.size})
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        <span>Cargando archivos...</span>
                    </div>
                ) : files.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        <p className="mb-2">Haz click en "Cargar Archivos" para ver el directorio de Supabase</p>
                        <p className="text-xs">Los archivos se cargan bajo demanda para mejorar el rendimiento</p>
                    </div>
                ) : (
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                        {sortedFolders.map(folder => {
                            const filesInFolder = folderStructure[folder];
                            const isExpanded = expandedFolders.has(folder);
                            const isFullySelected = isFolderFullySelected(folder);
                            const isPartiallySelected = isFolderPartiallySelected(folder);
                            const selectedCount = filesInFolder.filter(f => selectedFiles.has(f.name)).length;

                            return (
                                <div key={folder} className="border-b border-border/40 last:border-0">
                                    {/* Folder Header */}
                                    <div className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted/50 rounded">
                                        <Checkbox
                                            id={`folder-${folder}`}
                                            checked={isFullySelected}
                                            ref={(el) => {
                                                if (el && isPartiallySelected) {
                                                    el.indeterminate = true;
                                                }
                                            }}
                                            onCheckedChange={() => toggleFolder(folder)}
                                            className="mt-0.5"
                                        />
                                        <button
                                            onClick={() => toggleExpanded(folder)}
                                            className="flex items-center gap-1 flex-1 text-left"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="h-4 w-4 shrink-0" />
                                            ) : (
                                                <ChevronRight className="h-4 w-4 shrink-0" />
                                            )}
                                            <Folder className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                                            <span className="font-semibold text-sm">
                                                {folder}
                                            </span>
                                            <span className="text-xs text-muted-foreground ml-auto">
                                                ({selectedCount}/{filesInFolder.length})
                                            </span>
                                        </button>
                                    </div>

                                    {/* Files in Folder */}
                                    {isExpanded && (
                                        <div className="ml-8 space-y-1 mt-1">
                                            {filesInFolder.map(file => {
                                                const isChecked = selectedFiles.has(file.name);
                                                const fileName = file.name.substring(file.name.lastIndexOf('/') + 1);
                                                const matchInfo = extractMatchInfo(file.name);
                                                const isOutsideFixture = matchInfo?.isOutsideFixture === true;

                                                return (
                                                    <div key={file.name} className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted/50">
                                                        <Checkbox
                                                            id={`file-${file.name}`}
                                                            checked={isChecked}
                                                            onCheckedChange={() => toggleFileSelection(file.name)}
                                                            className="mt-0.5"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-1">
                                                                <File className="h-3 w-3 shrink-0 opacity-50" />
                                                                <span className="font-mono text-xs">{fileName}</span>
                                                                {isOutsideFixture && (
                                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                                                                        <AlertCircle className="h-2.5 w-2.5" />
                                                                        Fuera de fixture
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-muted-foreground ml-4">
                                                                {formatSize(file.metadata.size)} • Modificado: {formatDate(file.updated_at)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
