
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useGameState, formatTime, type Team, type GoalLog, type PenaltyLog, getCategoryNameById, getEndReasonText, type ShotLog, type AttendedPlayerInfo, getPeriodText } from "@/contexts/game-state-context";
import type { PlayerStats, PlayerData, PenaltyTypeDefinition } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Goal, Siren, FileText, FileDown, BarChart3, Edit3, Check, XCircle, Trash2, PlusCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportGameSummaryPDF } from "@/lib/pdf-generator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HockeyPuckSpinner } from "@/components/ui/hockey-puck-spinner";
import { AddPenaltyForm } from "@/components/shared/add-penalty-form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle as AlertTitle } from "@/components/ui/alert-dialog";

const GoalsSection = ({ team, teamName, goals }: { team: Team; teamName: string; goals: GoalLog[] }) => {
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

const PenaltiesSection = ({ team, teamName, penalties, onAdd, onDelete }: { team: Team; teamName: string; penalties: PenaltyLog[]; onAdd: () => void; onDelete: (logId: string) => void; }) => {
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
                        <TableHead className="text-right">Acción</TableHead>
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
                        <TableCell className="text-right">
                           <Button variant="ghost" size="icon" onClick={() => onDelete(p.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                           </Button>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                     <UiTableFooter>
                        <TableRow>
                            <TableCell colSpan={6} className="text-right font-bold">Total Penalidades: {penalties.length}</TableCell>
                        </TableRow>
                    </UiTableFooter>
                </Table>
                ) : <p className="text-sm text-muted-foreground">Sin penalidades registradas.</p>}
            </CardContent>
        </Card>
    );
};


const PlayerStatsSection = ({ team, teamName, playerStats, attendance, editable, periodText, onEdit }: { team: Team; teamName: string; playerStats?: PlayerStats; attendance?: AttendedPlayerInfo[]; editable?: boolean; periodText?: string, onEdit?: () => void }) => {
    const { dispatch } = useGameState();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [editedShots, setEditedShots] = useState<Record<string, string>>({});

    const attendedPlayersWithStats = useMemo(() => {
        const statsToUse = playerStats || {};
        const attendanceToUse = attendance || [];

        const playerMap = new Map<string, PlayerData & { shots: number, goals: number, assists: number }>();

        attendanceToUse.forEach(attendedPlayer => {
            playerMap.set(attendedPlayer.id, {
                id: attendedPlayer.id,
                number: attendedPlayer.number,
                name: attendedPlayer.name,
                type: 'player', 
                shots: 0,
                goals: 0,
                assists: 0,
            });
        });
        
        Object.entries(statsToUse).forEach(([playerNumber, stats]) => {
            const playerInAttendance = attendanceToUse.find(p => p.number === playerNumber);
            if (playerInAttendance && playerMap.has(playerInAttendance.id)) {
                const existingPlayer = playerMap.get(playerInAttendance.id)!;
                playerMap.set(existingPlayer.id, {
                    ...existingPlayer,
                    shots: stats.shots || 0,
                    goals: stats.goals || 0,
                    assists: stats.assists || 0,
                });
            }
        });


        return Array.from(playerMap.values()).sort((a, b) => {
            const numA = parseInt(a.number, 10);
            const numB = parseInt(b.number, 10);

            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (isNaN(numA) && !isNaN(numB)) return 1;
            if (!isNaN(numA) && isNaN(numB)) return -1;
            return a.name.localeCompare(b.name);
        });
    }, [attendance, playerStats]);

    const totals = useMemo(() => {
        return attendedPlayersWithStats.reduce((acc, player) => {
            acc.goals += player.goals || 0;
            acc.assists += player.assists || 0;
            acc.shots += player.shots || 0;
            return acc;
        }, { goals: 0, assists: 0, shots: 0 });
    }, [attendedPlayersWithStats]);

    const handleEditClick = () => {
        const initialShots = attendedPlayersWithStats.reduce((acc, player) => {
            acc[player.id] = String(player.shots || 0);
            return acc;
        }, {} as Record<string, string>);
        setEditedShots(initialShots);
        setIsEditing(true);
    };

    const handleCancelClick = () => {
        setIsEditing(false);
        setEditedShots({});
    };

    const handleSaveClick = () => {
        if (!periodText) return;
        let changesCount = 0;
        
        for (const player of attendedPlayersWithStats) {
            const originalShotCount = player.shots || 0;
            const newShotCountStr = editedShots[player.id];

            if (newShotCountStr === undefined || String(originalShotCount) === newShotCountStr) {
                continue;
            }

            const newShotCount = parseInt(newShotCountStr, 10);
            if (isNaN(newShotCount) || newShotCount < 0) {
                toast({ title: "Valor inválido", description: `El número de tiros para #${player.number} debe ser un número positivo.`, variant: "destructive" });
                return;
            }
            
            changesCount++;
            dispatch({
                type: 'SET_PLAYER_SHOTS',
                payload: {
                    team,
                    playerId: player.id,
                    playerNumber: player.number,
                    periodText,
                    shotCount: newShotCount
                }
            });
        }

        if (changesCount > 0) {
            toast({ title: "Tiros actualizados", description: `Se guardaron los cambios para ${changesCount} jugador(es).` });
            if(onEdit) onEdit();
        }
        
        setIsEditing(false);
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
                {editable && (
                    <div className="flex gap-2">
                        {isEditing ? (
                            <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" onClick={handleSaveClick}><Check className="h-5 w-5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleCancelClick}><X className="h-5 w-5" /></Button>
                            </>
                        ) : (
                            <Button variant="outline" size="sm" onClick={handleEditClick}><Edit3 className="mr-2 h-4 w-4"/>Editar Tiros</Button>
                        )}
                    </div>
                )}
            </CardHeader>
            <CardContent>
                {attendedPlayersWithStats.length > 0 ? (
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
                            {attendedPlayersWithStats.map(player => (
                                <TableRow key={player.id}>
                                    <TableCell className="font-semibold">{player.number || 'S/N'}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{player.name}</TableCell>
                                    <TableCell className="text-center font-mono">{player.goals || 0}</TableCell>
                                    <TableCell className="text-center font-mono">{player.assists || 0}</TableCell>
                                    <TableCell className="text-center">
                                       {isEditing && editable ? (
                                           <Input
                                                type="number"
                                                value={editedShots[player.id] || '0'}
                                                onChange={(e) => handleShotChange(player.id, e.target.value)}
                                                className="h-7 w-16 mx-auto text-center"
                                           />
                                       ) : (
                                           <span className="font-mono">{player.shots || 0}</span>
                                       )}
                                    </TableCell>
                                </TableRow>
                            ))}
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
            </CardContent>
        </Card>
    );
};


export default function ResumenPage() {
  const { state, dispatch, isLoading } = useGameState();
  const { toast } = useToast();
  
  const [refreshKey, setRefreshKey] = useState(0);

  const [isAddPenaltyDialogOpen, setIsAddPenaltyDialogOpen] = useState(false);
  const [penaltyContext, setPenaltyContext] = useState<{ team: Team, periodText: string } | null>(null);

  const [penaltyToDelete, setPenaltyToDelete] = useState<{ team: Team, logId: string } | null>(null);

  const allHomeGoals = useMemo(() => {
    if (!state.live.score) return [];
    return [...(state.live.score.homeGoals || [])].sort((a, b) => a.timestamp - b.timestamp);
  }, [state.live.score, refreshKey]);
  
  const allAwayGoals = useMemo(() => {
    if (!state.live.score) return [];
    return [...(state.live.score.awayGoals || [])].sort((a, b) => a.timestamp - b.timestamp);
  }, [state.live.score, refreshKey]);
  
  const allHomePenalties = useMemo(() => {
      if (!state.live.gameSummary.home) return [];
      return [...state.live.gameSummary.home.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp);
  }, [state.live.gameSummary.home, refreshKey]);

  const allAwayPenalties = useMemo(() => {
      if (!state.live.gameSummary.away) return [];
      return [...state.live.gameSummary.away.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp);
  }, [state.live.gameSummary.away, refreshKey]);
  
  const allPeriodTexts = useMemo(() => {
    if (!state.config) return [];
    const playedPeriods = new Set<string>();
    
    const lastPlayedPeriodNumber = state.live.clock.currentPeriod;
    for (let i = 1; i <= lastPlayedPeriodNumber; i++) {
        const periodText = getPeriodText(i, state.config.numberOfRegularPeriods);
        playedPeriods.add(periodText);
    }
    
    [...allHomeGoals, ...allAwayGoals, ...allHomePenalties, ...allAwayPenalties].forEach(event => {
        const period = event.periodText || event.addPeriodText;
        if (period && !period.toLowerCase().includes('warm-up') && !period.toLowerCase().includes('break')) {
            playedPeriods.add(period);
        }
    });

    const sortedPeriods = Array.from(playedPeriods);

    return sortedPeriods.sort((a, b) => {
        const getPeriodNumber = (text: string) => {
            if (text.startsWith('OT')) return (state.config?.numberOfRegularPeriods || 2) + parseInt(text.replace('OT', ''), 10);
            return parseInt(text.replace(/\D/g, ''), 10);
        };
        return getPeriodNumber(a) - getPeriodNumber(b);
    });
  }, [allHomeGoals, allAwayGoals, allHomePenalties, allAwayPenalties, state.config, state.live.clock.currentPeriod]);


  const escapeCsvCell = (cellData: any): string => {
    const stringData = String(cellData ?? '');
    if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
        return `"${stringData.replace(/"/g, '""')}"`;
    }
    return stringData;
  };

  const handleExportCSV = () => {
    const headers = ['Equipo', 'Tipo', 'Tiempo Juego', 'Periodo', '# Jugador', 'Nombre', '# Jugador 2', 'Nombre 2', 'Duración Pen.', 'Estado Pen.'];
    const rows: string[][] = [];

    allHomeGoals.forEach(g => rows.push([state.live.homeTeamName, 'Gol', formatTime(g.gameTime), g.periodText, g.scorer?.playerNumber || 'S/N', g.scorer?.playerName || '---', g.assist?.playerNumber || '', g.assist?.playerName || '', '', '']));
    allAwayGoals.forEach(g => rows.push([state.live.awayTeamName, 'Gol', formatTime(g.gameTime), g.periodText, g.scorer?.playerNumber || 'S/N', g.scorer?.playerName || '---', g.assist?.playerNumber || '', g.assist?.playerName || '', '', '']));
    allHomePenalties.forEach(p => rows.push([state.live.homeTeamName, 'Penalidad', formatTime(p.addGameTime), p.addPeriodText, p.playerNumber, p.playerName || '---', '', '', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason) ]));
    allAwayPenalties.forEach(p => rows.push([state.live.awayTeamName, 'Penalidad', formatTime(p.addGameTime), p.addPeriodText, p.playerNumber, p.playerName || '---', '', '', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason) ]));

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.map(escapeCsvCell).join(','), ...rows.map(row => row.map(escapeCsvCell).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `resumen_partido_${state.live.homeTeamName}_vs_${state.live.awayTeamName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleExportPDF = () => {
    const filename = exportGameSummaryPDF(state);
    toast({
        title: "Resumen Descargado",
        description: `El archivo ${filename} se ha guardado.`,
    });
  };

  const handleOpenAddPenalty = (team: Team, periodText: string) => {
    setPenaltyContext({ team, periodText });
    setIsAddPenaltyDialogOpen(true);
  };
  
  const handleConfirmAddPenalty = (team: Team, playerNumber: string, penaltyTypeId: string, gameTimeCs?: number) => {
    if (!penaltyContext) return;
    
    dispatch({
      type: 'ADD_PENALTY',
      payload: { 
        team: penaltyContext.team, 
        penalty: { playerNumber, penaltyTypeId },
        addGameTime: gameTimeCs, // Pass the manually entered time
        addPeriodText: penaltyContext.periodText,
      }
    });
    
    toast({ title: "Penalidad Añadida", description: "La penalidad se ha agregado al registro del partido."});
    setIsAddPenaltyDialogOpen(false);
    setPenaltyContext(null);
  };

  const handlePrepareDeletePenalty = (team: Team, logId: string) => {
      setPenaltyToDelete({ team, logId });
  };
  
  const handleConfirmDeletePenalty = () => {
      if (penaltyToDelete) {
        dispatch({ type: 'DELETE_PENALTY_LOG', payload: penaltyToDelete });
        toast({ title: "Penalidad Eliminada", variant: "destructive" });
        setPenaltyToDelete(null);
      }
  };


  if (isLoading || !state.live || !state.config) {
    return (
        <div className="flex flex-col justify-center items-center min-h-[calc(100vh-10rem)] text-center p-4">
            <HockeyPuckSpinner className="h-24 w-24 text-primary mb-4" />
            <p className="text-xl text-foreground">Cargando Resumen...</p>
        </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
            <h1 className="text-3xl font-bold text-primary-foreground">Resumen del Partido</h1>
            <div className="grid grid-cols-2 text-center my-2">
                <h3 className="text-2xl font-bold text-primary">{state.live.homeTeamName} - <span className="text-accent">{state.live.score.home}</span></h3>
                <h3 className="text-2xl font-bold text-primary">{state.live.awayTeamName} - <span className="text-accent">{state.live.score.away}</span></h3>
            </div>
             <div className="flex justify-start gap-2">
                <Button type="button" variant="outline" onClick={handleExportCSV}><FileText className="mr-2 h-4 w-4" />Exportar a CSV</Button>
                <Button type="button" variant="outline" onClick={handleExportPDF}><FileDown className="mr-2 h-4 w-4" />Exportar a PDF</Button>
            </div>
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
                            <GoalsSection team="home" teamName={state.live.homeTeamName} goals={allHomeGoals} />
                            <GoalsSection team="away" teamName={state.live.awayTeamName} goals={allAwayGoals} />
                        </div>
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <PenaltiesSection team="home" teamName={state.live.homeTeamName} penalties={allHomePenalties} onAdd={() => {}} onDelete={() => {}} />
                             <PenaltiesSection team="away" teamName={state.live.awayTeamName} penalties={allAwayPenalties} onAdd={() => {}} onDelete={() => {}} />
                        </div>
                        <Separator />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <PlayerStatsSection key={`home-total-${refreshKey}`} team="home" teamName={state.live.homeTeamName} playerStats={state.live.gameSummary.home.playerStats} attendance={state.live.gameSummary.attendance.home} />
                            <PlayerStatsSection key={`away-total-${refreshKey}`} team="away" teamName={state.live.awayTeamName} playerStats={state.live.gameSummary.away.playerStats} attendance={state.live.gameSummary.attendance.away} />
                        </div>
                    </div>
                </ScrollArea>
            </TabsContent>
            <TabsContent value="periods" className="mt-6">
                <ScrollArea className="h-[calc(100vh-22rem)]">
                    <Accordion type="single" collapsible className="w-full pr-4">
                        {allPeriodTexts.map(periodText => {
                        const homeGoalsInPeriod = allHomeGoals.filter(g => g.periodText === periodText);
                        const awayGoalsInPeriod = allAwayGoals.filter(g => g.periodText === periodText);
                        const homeShotsInPeriod = (state.live.gameSummary.home.homeShotsLog || []).filter(s => s.periodText === periodText);
                        const awayShotsInPeriod = (state.live.gameSummary.away.awayShotsLog || []).filter(s => s.periodText === periodText);
                        
                        const homeAttendance = state.live.gameSummary.attendance.home || [];
                        const awayAttendance = state.live.gameSummary.attendance.away || [];

                        const getPlayerStatsForPeriod = (
                            goals: GoalLog[],
                            shots: ShotLog[],
                            attendance: AttendedPlayerInfo[],
                        ): PlayerStats => {
                            const stats: Record<string, PlayerStats> = {};
                            attendance.forEach(p => {
                                stats[p.number] = { name: p.name, shots: 0, goals: 0, assists: 0 };
                            });
                            
                            goals.forEach(g => {
                                if (g.scorer?.playerNumber) {
                                    const key = g.scorer.playerNumber;
                                    if (!stats[key]) stats[key] = { name: g.scorer.playerName || '', goals: 0, assists: 0, shots: 0 };
                                    stats[key].goals++;
                                }
                                if (g.assist?.playerNumber) {
                                    const key = g.assist.playerNumber;
                                    if (!stats[key]) stats[key] = { name: g.assist.playerName || '', goals: 0, assists: 0, shots: 0 };
                                    stats[key].assists++;
                                }
                            });

                            shots.forEach(s => {
                                const key = s.playerNumber;
                                if (stats[key]) {
                                    stats[key].shots++;
                                } else { // Player might exist but not in stats yet
                                    const player = attendance.find(p => p.number === key);
                                    if (player) {
                                        stats[key] = { name: player.name, shots: 1, goals: 0, assists: 0 };
                                    }
                                }
                            });
                            return stats;
                        };


                        const homePlayerStatsInPeriod = getPlayerStatsForPeriod(homeGoalsInPeriod, homeShotsInPeriod, homeAttendance);
                        const awayPlayerStatsInPeriod = getPlayerStatsForPeriod(awayGoalsInPeriod, awayShotsInPeriod, awayAttendance);

                        const homePenaltiesInPeriod = allHomePenalties.filter(p => p.addPeriodText === periodText);
                        const awayPenaltiesInPeriod = allAwayPenalties.filter(p => p.addPeriodText === periodText);

                        return (
                            <AccordionItem value={periodText} key={periodText}>
                                <AccordionTrigger className="text-xl hover:no-underline">{periodText}</AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-8 pl-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <GoalsSection team="home" teamName={state.live.homeTeamName} goals={homeGoalsInPeriod} />
                                            <GoalsSection team="away" teamName={state.live.awayTeamName} goals={awayGoalsInPeriod} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <PenaltiesSection team="home" teamName={state.live.homeTeamName} penalties={homePenaltiesInPeriod} onAdd={() => handleOpenAddPenalty('home', periodText)} onDelete={(logId) => handlePrepareDeletePenalty('home', logId)} />
                                            <PenaltiesSection team="away" teamName={state.live.awayTeamName} penalties={awayPenaltiesInPeriod} onAdd={() => handleOpenAddPenalty('away', periodText)} onDelete={(logId) => handlePrepareDeletePenalty('away', logId)} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <PlayerStatsSection team="home" teamName={state.live.homeTeamName} playerStats={homePlayerStatsInPeriod} attendance={homeAttendance} editable={true} periodText={periodText} onEdit={() => setRefreshKey(k => k + 1)} />
                                            <PlayerStatsSection team="away" teamName={state.live.awayTeamName} playerStats={awayPlayerStatsInPeriod} attendance={awayAttendance} editable={true} periodText={periodText} onEdit={() => setRefreshKey(k => k + 1)} />
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

        {isAddPenaltyDialogOpen && penaltyContext && (
            <Dialog open={isAddPenaltyDialogOpen} onOpenChange={setIsAddPenaltyDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Añadir Penalidad a {penaltyContext.periodText}</DialogTitle>
                        <DialogDescription>
                            Registra una nueva penalidad para el {penaltyContext.team === 'home' ? state.live.homeTeamName : state.live.awayTeamName} en el período {penaltyContext.periodText}.
                        </DialogDescription>
                    </DialogHeader>
                    <AddPenaltyForm
                        homeTeamName={state.live.homeTeamName}
                        awayTeamName={state.live.awayTeamName}
                        penaltyTypes={state.config.penaltyTypes || []}
                        defaultPenaltyTypeId={state.config.defaultPenaltyTypeId || null}
                        onPenaltySent={(team, playerNumber, penaltyTypeId, gameTimeCs) => handleConfirmAddPenalty(team, playerNumber, penaltyTypeId, gameTimeCs)}
                        preselectedTeam={penaltyContext.team}
                        showTimeInput={true}
                    />
                </DialogContent>
            </Dialog>
        )}

        {penaltyToDelete && (
            <AlertDialog open={!!penaltyToDelete} onOpenChange={() => setPenaltyToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertTitle>Confirmar Eliminación</AlertTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro de que quieres eliminar esta penalidad? Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPenaltyToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmDeletePenalty} className="bg-destructive hover:bg-destructive/90">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )}
    </div>
  );
}

    
