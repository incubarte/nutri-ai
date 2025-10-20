

"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useGameState, formatTime, type Team, getCategoryNameById, getEndReasonText, type ShotLog, type AttendedPlayerInfo } from "@/contexts/game-state-context";
import type { PlayerData, PenaltyLog, GoalLog, PlayerStats as LivePlayerStats } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Goal, Siren, FileText, FileDown, BarChart3, Edit3, Check, XCircle, Trash2, PlusCircle, X, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportGameSummaryPDF } from "@/lib/pdf-generator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";
import { AddPenaltyForm } from "@/components/shared/add-penalty-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDesc, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertTitle } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { safeUUID } from "@/lib/utils";


// Simplified model for the summary page
interface SummaryPlayerStats {
  id: string;
  number: string;
  name: string;
  shots: number;
  goals: number;
  assists: number;
}

interface SummaryData {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  categoryName: string;
  home: {
    goals: GoalLog[];
    penalties: PenaltyLog[];
    playerStats: SummaryPlayerStats[];
    shotsLog: ShotLog[];
  };
  away: {
    goals: GoalLog[];
    penalties: PenaltyLog[];
    playerStats: SummaryPlayerStats[];
    shotsLog: ShotLog[];
  };
}

const GoalsSection = ({ teamName, goals }: { teamName: string; goals: GoalLog[] }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Goal className="h-5 w-5" />Goles</CardTitle>
            </CardHeader>
            <CardContent>
                {goals.length > 0 ? (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Tiempo</TableHead>
                        <TableHead>Gol</TableHead>
                        <TableHead>Asistencia</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {goals.map(goal => (
                        <TableRow key={goal.id}>
                        <TableCell>
                            <div className="font-mono text-sm">{formatTime(goal.gameTime)}</div>
                            <div className="text-xs text-muted-foreground">{goal.periodText}</div>
                        </TableCell>
                        <TableCell>
                            <div className="font-semibold">#{goal.scorer?.playerNumber || 'S/N'}</div>
                            <div className="text-xs text-muted-foreground">{goal.scorer?.playerName || '---'}</div>
                        </TableCell>
                        <TableCell>
                            {goal.assist?.playerNumber ? (
                            <>
                                <div className="font-semibold">#{goal.assist.playerNumber}</div>
                                <div className="text-xs text-muted-foreground">{goal.assist.playerName || '---'}</div>
                            </>
                            ) : <span className="text-muted-foreground">---</span>}
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                    <UiTableFooter>
                        <TableRow>
                            <TableCell colSpan={3} className="text-right font-bold">Total Goles: {goals.length}</TableCell>
                        </TableRow>
                    </UiTableFooter>
                </Table>
                ) : <p className="text-sm text-muted-foreground">Sin goles registrados.</p>}
            </CardContent>
        </Card>
    );
};

const PenaltiesSection = ({ team, teamName, penalties, onAdd, onDelete }: { team: Team; teamName: string; penalties: PenaltyLog[]; onAdd?: () => void; onDelete?: (logId: string) => void; }) => {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl"><Siren className="h-5 w-5" />Penalidades</CardTitle>
                {onAdd && (
                    <Button variant="ghost" size="icon" onClick={onAdd} className="h-8 w-8 text-primary hover:text-primary/80">
                        <PlusCircle className="h-5 w-5" />
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {penalties.length > 0 ? (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Tiempo</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Estado</TableHead>
                         {onDelete && <TableHead className="text-right">Acción</TableHead>}
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {penalties.map(p => (
                        <TableRow key={p.id}>
                        <TableCell>
                            <div className="font-mono text-sm">{formatTime(p.addGameTime)}</div>
                            <div className="text-xs text-muted-foreground">{p.addPeriodText}</div>
                        </TableCell>
                        <TableCell>
                            <div className="font-semibold">{p.isBenchPenalty ? `Banco (#${p.playerNumber})` : `#${p.playerNumber}`}</div>
                            <div className="text-xs text-muted-foreground">{p.isBenchPenalty ? '---' : p.playerName || '---'}</div>
                        </TableCell>
                        <TableCell className="text-xs">{p.penaltyName || '---'}</TableCell>
                        <TableCell className="font-mono text-sm">{formatTime(p.initialDuration * 100)}</TableCell>
                        <TableCell>
                            <div className="text-sm">{getEndReasonText(p.endReason)}</div>
                            {p.timeServed !== undefined && <div className="text-xs text-muted-foreground font-mono">({formatTime(p.timeServed * 100)})</div>}
                        </TableCell>
                         {onDelete && (
                            <TableCell className="text-right">
                               <Button variant="ghost" size="icon" onClick={() => onDelete(p.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                               </Button>
                            </TableCell>
                         )}
                        </TableRow>
                    ))}
                    </TableBody>
                     <UiTableFooter>
                        <TableRow>
                            <TableCell colSpan={onDelete ? 6 : 5} className="text-right font-bold">Total Penalidades: {penalties.length}</TableCell>
                        </TableRow>
                    </UiTableFooter>
                </Table>
                ) : <p className="text-sm text-muted-foreground">Sin penalidades registradas.</p>}
            </CardContent>
        </Card>
    );
};

const PlayerStatsSection = ({ team, teamName, playerStats, attendance, editable, periodText, onEdit }: { team: Team; teamName: string; playerStats: SummaryPlayerStats[]; attendance?: AttendedPlayerInfo[]; editable?: boolean; periodText?: string, onEdit?: () => void }) => {
    
    const [isEditing, setIsEditing] = useState(false);
    const [editedShots, setEditedShots] = useState<Record<string, string>>({});
    const { dispatch } = useGameState();

    const sortedPlayerStats = useMemo(() => {
        return [...playerStats].sort((a, b) => {
            const numA = parseInt(a.number, 10);
            const numB = parseInt(b.number, 10);

            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (isNaN(numA) && !isNaN(numB)) return 1;
            if (!isNaN(numA) && isNaN(numB)) return -1;
            return a.name.localeCompare(b.name);
        });
    }, [playerStats]);


    const totals = useMemo(() => {
        return sortedPlayerStats.reduce((acc, player) => {
            acc.goals += player.goals || 0;
            acc.assists += player.assists || 0;
            acc.shots += player.shots || 0;
            return acc;
        }, { goals: 0, assists: 0, shots: 0 });
    }, [sortedPlayerStats]);

    const handleEditClick = () => {
        const initialShots = sortedPlayerStats.reduce((acc, player) => {
            acc[player.id] = String(player.shots || 0);
            return acc;
        }, {} as Record<string, string>);
        setEditedShots(initialShots);
        setIsEditing(true);
    };

    const handleCancelClick = () => setIsEditing(false);

    const handleSaveClick = () => {
        if (!editable || !periodText || !onEdit) return;

        Object.entries(editedShots).forEach(([playerId, newShotCountStr]) => {
            const originalPlayer = sortedPlayerStats.find(p => p.id === playerId);
            if (originalPlayer && String(originalPlayer.shots) !== newShotCountStr) {
                const newShotCount = parseInt(newShotCountStr, 10);
                if (!isNaN(newShotCount)) {
                    dispatch({
                        type: 'SET_PLAYER_SHOTS',
                        payload: { team, playerId, periodText, shotCount: newShotCount }
                    });
                }
            }
        });
        setIsEditing(false);
        onEdit(); // Callback to trigger refresh
    };

    const handleShotChange = (playerId: string, value: string) => {
        if (/^\d*$/.test(value)) {
            setEditedShots(prev => ({ ...prev, [playerId]: value }));
        }
    };
    
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl"><BarChart3 className="h-5 w-5" />Estadísticas - {teamName}</CardTitle>
                 {editable && periodText ? (
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" onClick={handleSaveClick}><Check className="h-5 w-5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleCancelClick}><X className="h-5 w-5" /></Button>
                            </>
                        ) : (
                            <Button variant="outline" size="sm" onClick={handleEditClick}>
                                <Edit3 className="mr-2 h-4 w-4"/>Editar Tiros
                            </Button>
                        )}
                    </div>
                ) : editable && !periodText ? (
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="outline" size="sm" disabled>
                                    <Edit3 className="mr-2 h-4 w-4"/>Editar Tiros
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>La edición de tiros debe hacerse por período en la pestaña "Detalle por Periodo".</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                ) : null}
            </CardHeader>
            <CardContent>
                <TooltipProvider>
                    {sortedPlayerStats.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>#</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead className="text-center">G</TableHead>
                                    <TableHead className="text-center">A</TableHead>
                                    <TableHead className="text-center">Tiros</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedPlayerStats.map(player => {
                                    const isEditDisabledForThisRow = isEditing && (!player.number || (editable && !periodText));
                                    return (
                                        <TableRow key={player.id} className={cn(isEditDisabledForThisRow && "opacity-50")}>
                                            <TableCell className="font-semibold">{player.number || 'S/N'}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{player.name}</TableCell>
                                            <TableCell className="text-center font-mono">{player.goals || 0}</TableCell>
                                            <TableCell className="text-center font-mono">{player.assists || 0}</TableCell>
                                            <TableCell className="text-center">
                                            {isEditing && editable && periodText && player.number ? (
                                                <Input
                                                    type="number"
                                                    value={editedShots[player.id]}
                                                    onChange={(e) => handleShotChange(player.id, e.target.value)}
                                                    className={cn("h-7 w-16 mx-auto text-center")}
                                                />
                                            ) : isEditing && editable && periodText && !player.number ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Input
                                                                type="number"
                                                                value={String(player.shots || 0)}
                                                                className="h-7 w-16 mx-auto text-center cursor-not-allowed"
                                                                disabled
                                                            />
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>No se pueden editar los tiros de un jugador sin número asignado.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : (
                                                <span className="font-mono">{player.shots || 0}</span>
                                            )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                            <UiTableFooter>
                                <TableRow>
                                    <TableCell colSpan={2} className="text-right font-bold">TOTAL</TableCell>
                                    <TableCell className="text-center font-bold font-mono">{totals.goals}</TableCell>
                                    <TableCell className="text-center font-bold font-mono">{totals.assists}</TableCell>
                                    <TableCell className="text-center font-bold font-mono">{totals.shots}</TableCell>
                                </TableRow>
                            </UiTableFooter>
                        </Table>
                    ) : (
                        <p className="text-sm text-muted-foreground">No hay jugadores con asistencia registrada.</p>
                    )}
                </TooltipProvider>
            </CardContent>
        </Card>
    );
};


export default function ResumenPage() {
  const { state: liveGameState, dispatch, isLoading } = useGameState();
  const { toast } = useToast();
  
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isAddPenaltyDialogOpen, setIsAddPenaltyDialogOpen] = useState(false);
  const [penaltyContext, setPenaltyContext] = useState<{ team: Team, periodText?: string } | null>(null);
  const [penaltyToDelete, setPenaltyToDelete] = useState<{ team: Team, logId: string } | null>(null);
  const [overwriteConfirm, setOverwriteConfirm] = useState<{ onConfirm: () => void } | null>(null);
  const [unassignedPlayerWarning, setUnassignedPlayerWarning] = useState<{ players: string[]; onConfirm: () => void } | null>(null);
  
  const generateSummaryData = useCallback(() => {
    const { live, config } = liveGameState;
    
    // Always clear old data first
    setSummaryData(null);
    
    const calculatePlayerStats = (team: Team): SummaryPlayerStats[] => {
      const attendance = live.gameSummary.attendance[team] || [];
      const statsMap = new Map<string, SummaryPlayerStats>();

      attendance.forEach(p => {
        statsMap.set(p.id, { id: p.id, number: p.number, name: p.name, goals: 0, assists: 0, shots: 0 });
      });

      (live.gameSummary[team]?.goals || []).forEach(goal => {
        const scorer = attendance.find(p => p.number === goal.scorer?.playerNumber);
        if (scorer) {
          const stat = statsMap.get(scorer.id);
          if (stat) stat.goals++;
        }
        const assist = attendance.find(p => p.number === goal.assist?.playerNumber);
        if (assist) {
          const stat = statsMap.get(assist.id);
          if (stat) stat.assists++;
        }
      });
      
      const shotsLogKey = `${team}ShotsLog` as const;
      (live.gameSummary[team]?.[shotsLogKey] || []).forEach(shot => {
        const shooter = attendance.find(p => p.id === shot.playerId);
        if (shooter) {
           const stat = statsMap.get(shooter.id);
           if (stat) stat.shots++;
        }
      });

      return Array.from(statsMap.values());
    };
    
    const newSummary: SummaryData = {
        homeTeamName: live.homeTeamName,
        awayTeamName: live.awayTeamName,
        homeScore: live.score.home,
        awayScore: live.score.away,
        categoryName: getCategoryNameById(config.selectedMatchCategory, config.availableCategories) || 'N/A',
        home: {
            goals: [...live.gameSummary.home.goals].sort((a,b) => a.timestamp - b.timestamp),
            penalties: [...live.gameSummary.home.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp),
            shotsLog: [...(live.gameSummary.home.homeShotsLog || [])],
            playerStats: calculatePlayerStats('home'),
        },
        away: {
            goals: [...live.gameSummary.away.goals].sort((a,b) => a.timestamp - b.timestamp),
            penalties: [...live.gameSummary.away.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp),
            shotsLog: [...(live.gameSummary.away.awayShotsLog || [])],
            playerStats: calculatePlayerStats('away'),
        },
    };
    setSummaryData(newSummary);
  }, [liveGameState]);

  useEffect(() => {
    const { goals: homeGoals, penalties: homePenalties } = liveGameState.live.gameSummary.home;
    const { goals: awayGoals, penalties: awayPenalties } = liveGameState.live.gameSummary.away;
    if (homeGoals.length > 0 || homePenalties.length > 0 || awayGoals.length > 0 || awayPenalties.length > 0) {
      generateSummaryData();
    }
  }, []); 

   // Effect to refresh summary data whenever live game summary changes
  useEffect(() => {
    if (summaryData) { // Only refresh if a summary is already being displayed
      generateSummaryData();
    }
  }, [liveGameState.live.gameSummary, generateSummaryData, summaryData]);
  
  const allPeriodTexts = useMemo(() => {
    if (!summaryData) return [];
    const playedPeriods = new Set<string>();
    
    [...summaryData.home.goals, ...summaryData.away.goals, ...summaryData.home.penalties, ...summaryData.away.penalties].forEach(event => {
        const period = event.periodText || event.addPeriodText;
        if (period && !period.toLowerCase().includes('warm-up') && !period.toLowerCase().includes('break')) {
            playedPeriods.add(period);
        }
    });

    const sortedPeriods = Array.from(playedPeriods);

    return sortedPeriods.sort((a, b) => {
        const getPeriodNumber = (text: string) => {
            if (text.startsWith('OT')) return (liveGameState.config?.numberOfRegularPeriods || 2) + parseInt(text.replace('OT', ''), 10);
            return parseInt(text.replace(/\D/g, ''), 10);
        };
        return getPeriodNumber(a) - getPeriodNumber(b);
    });
  }, [summaryData, liveGameState.config]);
  
  const handleGenerateSummaryClick = () => {
    const unassignedHome = liveGameState.live.gameSummary.attendance.home.filter(p => !p.number).map(p => p.name);
    const unassignedAway = liveGameState.live.gameSummary.attendance.away.filter(p => !p.number).map(p => p.name);
    const allUnassigned = [...unassignedHome, ...unassignedAway];

    const confirmAndGenerate = () => {
      setSummaryData(null); // Clean the model first
      if (allUnassigned.length > 0) {
        setUnassignedPlayerWarning({ players: allUnassigned, onConfirm: () => { generateSummaryData(); toast({ title: "Resumen Generado" }); } });
      } else {
        generateSummaryData();
        toast({ title: "Resumen Generado", description: "Se han cargado los datos del partido actual." });
      }
    };
    
    if (summaryData) {
      setOverwriteConfirm({ onConfirm: confirmAndGenerate });
    } else {
      confirmAndGenerate();
    }
  };


  const escapeCsvCell = (cellData: any): string => {
    if (!summaryData) return '';
    const stringData = String(cellData ?? '');
    if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
        return `"${stringData.replace(/"/g, '""')}"`;
    }
    return stringData;
  };

  const handleExportCSV = () => {
    if (!summaryData) return;
    const headers = ['Equipo', 'Tipo', 'Tiempo Juego', 'Periodo', '# Jugador', 'Nombre', '# Jugador 2', 'Nombre 2', 'Duración Pen.', 'Estado Pen.'];
    const rows: string[][] = [];

    summaryData.home.goals.forEach(g => rows.push([summaryData.homeTeamName, 'Gol', formatTime(g.gameTime), g.periodText, g.scorer?.playerNumber || 'S/N', g.scorer?.playerName || '---', g.assist?.playerNumber || '', g.assist?.playerName || '', '', '']));
    summaryData.away.goals.forEach(g => rows.push([summaryData.awayTeamName, 'Gol', formatTime(g.gameTime), g.periodText, g.scorer?.playerNumber || 'S/N', g.scorer?.playerName || '---', g.assist?.playerNumber || '', g.assist?.playerName || '', '', '']));
    summaryData.home.penalties.forEach(p => rows.push([summaryData.homeTeamName, 'Penalidad', formatTime(p.addGameTime), p.addPeriodText, p.playerNumber, p.playerName || '---', '', '', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason) ]));
    summaryData.away.penalties.forEach(p => rows.push([summaryData.awayTeamName, 'Penalidad', formatTime(p.addGameTime), p.addPeriodText, p.playerNumber, p.playerName || '---', '', '', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason) ]));

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.map(escapeCsvCell).join(','), ...rows.map(row => row.map(escapeCsvCell).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `resumen_partido_${summaryData.homeTeamName}_vs_${summaryData.awayTeamName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleExportPDF = () => {
     if (!summaryData) return;
    const tempStateForPDF = { ...liveGameState, live: { ...liveGameState.live, score: { ...liveGameState.live.score, home: summaryData.homeScore, away: summaryData.awayScore, homeGoals: summaryData.home.goals, awayGoals: summaryData.away.goals }, gameSummary: {
        home: { ...liveGameState.live.gameSummary.home, goals: summaryData.home.goals, penalties: summaryData.home.penalties, playerStats: summaryData.home.playerStats.reduce((acc, p) => ({...acc, [p.number]: p}), {}) },
        away: { ...liveGameState.live.gameSummary.away, goals: summaryData.away.goals, penalties: summaryData.away.penalties, playerStats: summaryData.away.playerStats.reduce((acc, p) => ({...acc, [p.number]: p}), {}) },
        attendance: liveGameState.live.gameSummary.attendance
    }}};
    // @ts-ignore - This is a temporary solution for the PDF generator
    const filename = exportGameSummaryPDF(tempStateForPDF);
    toast({
        title: "Resumen Descargado",
        description: `El archivo ${filename} se ha guardado.`,
    });
  };

  const handleOpenAddPenalty = (team: Team, periodText?: string) => {
    setPenaltyContext({ team, periodText });
    setIsAddPenaltyDialogOpen(true);
  };
  
  const handleConfirmAddPenalty = (team: Team, playerNumber: string, penaltyTypeId: string, gameTimeCs: number, periodText: string) => {
    if (!summaryData || !penaltyContext) return;
    
    dispatch({ type: 'ADD_PENALTY', payload: {
        team,
        penalty: { playerNumber, penaltyTypeId },
        addGameTime: gameTimeCs,
        addPeriodText: periodText,
    }});
    
    toast({ title: "Penalidad Añadida", description: "La penalidad se ha agregado al resumen."});
    setIsAddPenaltyDialogOpen(false);
    setPenaltyContext(null);
  };

  const handlePrepareDeletePenalty = (team: Team, logId: string) => {
      setPenaltyToDelete({ team, logId });
  };
  
  const handleConfirmDeletePenalty = () => {
      if (penaltyToDelete && summaryData) {
        dispatch({ type: 'DELETE_PENALTY_LOG', payload: { team: penaltyToDelete.team, logId: penaltyToDelete.logId }});
        toast({ title: "Penalidad Eliminada", variant: "destructive" });
        setPenaltyToDelete(null);
      }
  };


  if (isLoading) {
    return (
        <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
            <HockeyPuckSpinner className="h-24 w-24 text-primary mb-4" />
            <p className="text-xl text-foreground">Cargando...</p>
        </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-primary-foreground">Resumen del Partido</h1>
            <Button onClick={handleGenerateSummaryClick}><RefreshCw className="mr-2 h-4 w-4"/> Generar Resumen con Datos del Partido</Button>
        </div>

        {!summaryData ? (
             <Card className="text-center py-20">
                <CardContent>
                    <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold">Resumen no generado</h2>
                    <p className="text-muted-foreground">Haz clic en el botón de arriba para cargar las estadísticas del partido actual.</p>
                </CardContent>
            </Card>
        ) : (
            <>
                <div className="grid grid-cols-2 text-center my-2">
                    <h3 className="text-2xl font-bold text-primary">{summaryData.homeTeamName} - <span className="text-accent">{summaryData.homeScore}</span></h3>
                    <h3 className="text-2xl font-bold text-primary">{summaryData.awayTeamName} - <span className="text-accent">{summaryData.awayScore}</span></h3>
                </div>
                 <div className="flex justify-start gap-2">
                    <Button type="button" variant="outline" onClick={handleExportCSV}><FileText className="mr-2 h-4 w-4" />Exportar a CSV</Button>
                    <Button type="button" variant="outline" onClick={handleExportPDF}><FileDown className="mr-2 h-4 w-4" />Exportar a PDF</Button>
                </div>
                
                <Tabs defaultValue="general">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="general">Estadísticas Generales</TabsTrigger>
                        <TabsTrigger value="periods">Detalle por Periodo</TabsTrigger>
                    </TabsList>
                    <TabsContent value="general" className="mt-6">
                        <ScrollArea className="h-[calc(100vh-22rem)]">
                            <div className="space-y-6 pr-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <GoalsSection teamName={summaryData.homeTeamName} goals={summaryData.home.goals} />
                                    <GoalsSection teamName={summaryData.awayTeamName} goals={summaryData.away.goals} />
                                </div>
                                <Separator />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <PenaltiesSection team="home" teamName={summaryData.homeTeamName} penalties={summaryData.home.penalties} />
                                     <PenaltiesSection team="away" teamName={summaryData.awayTeamName} penalties={summaryData.away.penalties} />
                                </div>
                                <Separator />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <PlayerStatsSection team="home" teamName={summaryData.homeTeamName} playerStats={summaryData.home.playerStats} attendance={liveGameState.live.gameSummary.attendance.home} editable={false} />
                                    <PlayerStatsSection team="away" teamName={summaryData.awayTeamName} playerStats={summaryData.away.playerStats} attendance={liveGameState.live.gameSummary.attendance.away} editable={false} />
                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="periods" className="mt-6">
                        <ScrollArea className="h-[calc(100vh-22rem)]">
                            <Accordion type="single" collapsible className="w-full pr-4">
                                {allPeriodTexts.map(periodText => {
                                const homeGoalsInPeriod = summaryData.home.goals.filter(g => g.periodText === periodText);
                                const awayGoalsInPeriod = summaryData.away.goals.filter(g => g.periodText === periodText);
                                
                                const getPlayerStatsForPeriod = (team: Team, period: string) => {
                                  const goalsInPeriod = summaryData[team].goals.filter(g => g.periodText === period);
                                  const shotsInPeriod = (summaryData[team].shotsLog || []).filter(s => s.periodText === period);
                                  
                                  const playerStatsMap = new Map<string, SummaryPlayerStats>();
                                  liveGameState.live.gameSummary.attendance[team].forEach(p => {
                                      playerStatsMap.set(p.id, { id: p.id, number: p.number, name: p.name, shots: 0, goals: 0, assists: 0 });
                                  });

                                  goalsInPeriod.forEach(g => {
                                      const scorer = liveGameState.live.gameSummary.attendance[team].find(p => p.number === g.scorer?.playerNumber);
                                      if (scorer) {
                                          const stat = playerStatsMap.get(scorer.id);
                                          if(stat) stat.goals++;
                                      }
                                      const assist = liveGameState.live.gameSummary.attendance[team].find(p => p.number === g.assist?.playerNumber);
                                      if (assist) {
                                          const stat = playerStatsMap.get(assist.id);
                                          if(stat) stat.assists++;
                                      }
                                  });

                                  shotsInPeriod.forEach(s => {
                                      const shooter = liveGameState.live.gameSummary.attendance[team].find(p => p.id === s.playerId);
                                      if(shooter) {
                                          const stat = playerStatsMap.get(shooter.id);
                                          if (stat) stat.shots++;
                                      }
                                  });

                                  return Array.from(playerStatsMap.values());
                                };

                                const homePlayerStatsInPeriod = getPlayerStatsForPeriod('home', periodText);
                                const awayPlayerStatsInPeriod = getPlayerStatsForPeriod('away', periodText);


                                const homePenaltiesInPeriod = summaryData.home.penalties.filter(p => p.addPeriodText === periodText);
                                const awayPenaltiesInPeriod = summaryData.away.penalties.filter(p => p.addPeriodText === periodText);

                                return (
                                    <AccordionItem value={periodText} key={periodText}>
                                        <AccordionTrigger className="text-xl hover:no-underline">{periodText}</AccordionTrigger>
                                        <AccordionContent>
                                            <div className="space-y-8 pl-2">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <GoalsSection teamName={summaryData.homeTeamName} goals={homeGoalsInPeriod} />
                                                    <GoalsSection teamName={summaryData.awayTeamName} goals={awayGoalsInPeriod} />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <PenaltiesSection team="home" teamName={summaryData.homeTeamName} penalties={homePenaltiesInPeriod} onAdd={() => handleOpenAddPenalty('home', periodText)} onDelete={(logId) => handlePrepareDeletePenalty('home', logId)} />
                                                    <PenaltiesSection team="away" teamName={summaryData.awayTeamName} penalties={awayPenaltiesInPeriod} onAdd={() => handleOpenAddPenalty('away', periodText)} onDelete={(logId) => handlePrepareDeletePenalty('away', logId)} />
                                                </div>
                                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <PlayerStatsSection team="home" teamName={summaryData.homeTeamName} playerStats={homePlayerStatsInPeriod} attendance={liveGameState.live.gameSummary.attendance.home} editable={true} periodText={periodText} onEdit={() => generateSummaryData()} />
                                                    <PlayerStatsSection team="away" teamName={summaryData.awayTeamName} playerStats={awayPlayerStatsInPeriod} attendance={liveGameState.live.gameSummary.attendance.away} editable={true} periodText={periodText} onEdit={() => generateSummaryData()} />
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                )
                                })}
                            </Accordion>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </>
        )}

        {isAddPenaltyDialogOpen && penaltyContext && (
            <Dialog open={isAddPenaltyDialogOpen} onOpenChange={setIsAddPenaltyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Añadir Penalidad</DialogTitle>
                        <DialogDescription>
                            Registra una nueva penalidad para el {penaltyContext.team === 'home' ? summaryData?.homeTeamName : summaryData?.awayTeamName}
                            {penaltyContext.periodText ? ` en el período ${penaltyContext.periodText}` : ''}.
                        </DialogDescription>
                    </DialogHeader>
                    <AddPenaltyForm
                        homeTeamName={summaryData?.homeTeamName || 'Local'}
                        awayTeamName={summaryData?.awayTeamName || 'Visitante'}
                        penaltyTypes={liveGameState.config.penaltyTypes || []}
                        defaultPenaltyTypeId={liveGameState.config.defaultPenaltyTypeId || null}
                        onPenaltySent={(team, playerNumber, penaltyTypeId, gameTimeCs, periodText) => handleConfirmAddPenalty(team, playerNumber, penaltyTypeId, gameTimeCs!, periodText!)}
                        preselectedTeam={penaltyContext.team}
                        showTimeInput={true}
                        availablePeriods={allPeriodTexts}
                        preselectedPeriod={penaltyContext.periodText}
                    />
                </DialogContent>
            </Dialog>
        )}

        {penaltyToDelete && (
            <AlertDialog open={!!penaltyToDelete} onOpenChange={() => setPenaltyToDelete(null)}>
                <AlertDialogContent>
                    <AlertTitle>Confirmar Eliminación</AlertTitle>
                    <AlertDialogDesc>
                        ¿Estás seguro de que quieres eliminar esta penalidad? Esta acción no se puede deshacer.
                    </AlertDialogDesc>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPenaltyToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDeletePenalty} className="bg-destructive hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
        
        {overwriteConfirm && (
            <AlertDialog open={!!overwriteConfirm} onOpenChange={() => setOverwriteConfirm(null)}>
                <AlertDialogContent>
                    <AlertTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" /> Confirmar Generación de Resumen</AlertTitle>
                    <AlertDialogDesc>
                        Ya existe un resumen generado. Si continúas, se perderán todos los cambios manuales que hayas hecho en este resumen. ¿Deseas continuar y reemplazar los datos?
                    </AlertDialogDesc>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setOverwriteConfirm(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { overwriteConfirm.onConfirm(); setOverwriteConfirm(null); }}>
                            Sí, Reemplazar Datos
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}

        {unassignedPlayerWarning && (
            <AlertDialog open={!!unassignedPlayerWarning} onOpenChange={() => setUnassignedPlayerWarning(null)}>
                <AlertDialogContent>
                    <AlertTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" /> Jugadores sin Número Asignado</AlertTitle>
                    <AlertDialogDesc>
                        Los siguientes jugadores tienen asistencia registrada pero no tienen un número asignado. Si continúas, no podrás editar sus estadísticas de tiros más adelante.
                    </AlertDialogDesc>
                    <ScrollArea className="max-h-32 mt-4 border bg-muted/50 p-2 rounded-md">
                       <ul className="list-disc pl-5">
                            {unassignedPlayerWarning.players.map((name, i) => <li key={i}>{name}</li>)}
                       </ul>
                    </ScrollArea>
                    <AlertDialogDesc className="mt-2">
                        ¿Deseas generar el resumen de todas formas?
                    </AlertDialogDesc>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setUnassignedPlayerWarning(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { unassignedPlayerWarning.onConfirm(); setUnassignedPlayerWarning(null); }}>
                            Generar de Todas Formas
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
    </div>
  );
}
    

    



