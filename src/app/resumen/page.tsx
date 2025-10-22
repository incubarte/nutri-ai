

"use client";

import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useGameState, formatTime, type Team, getCategoryNameById, getEndReasonText, type ShotLog, type AttendedPlayerInfo, SUMMARY_DATA_STORAGE_KEY, getPeriodText } from "@/contexts/game-state-context";
import type { PlayerData, GoalLog, PlayerStats as LivePlayerStats, GameSummary, SummaryPlayerStats, GameState, ShootoutState, ShootoutAttempt } from "@/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Goal, Siren, FileText, FileDown, BarChart3, Edit3, Check, XCircle, Trash2, PlusCircle, X, AlertTriangle, Info, RefreshCw, Swords, Save } from "lucide-react";
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
import type { PenaltyLog } from "@/types";
import { saveGameSummary, saveTeamCsvSummary } from "@/ai/flows/file-operations";


// --- Modelos de Datos para la Página de Resumen ---
interface PeriodStats {
  home: { goals: GoalLog[]; penalties: PenaltyLog[]; playerStats: SummaryPlayerStats[]; };
  away: { goals: GoalLog[]; penalties: PenaltyLog[]; playerStats: SummaryPlayerStats[]; };
}

interface SummaryData {
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  categoryName: string;
  statsByPeriod: Record<string, PeriodStats>;
  attendance: {
      home: AttendedPlayerInfo[];
      away: AttendedPlayerInfo[];
  };
  shootout?: ShootoutState;
}
// --- Fin de Modelos de Datos ---


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

const PlayerStatsSection = ({ team, teamName, playerStats, onStatsChange, editable, periodText }: { team: Team; teamName: string; playerStats: SummaryPlayerStats[]; onStatsChange?: (team: Team, newStats: SummaryPlayerStats[], period: string) => void, editable?: boolean, periodText?: string }) => {
    
    const [isEditing, setIsEditing] = useState(false);
    const [editedShots, setEditedShots] = useState<Record<string, string>>({});
    
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
        if (!onStatsChange || !periodText) return;

        const newPlayerStats = playerStats.map(player => {
            const newShotCountStr = editedShots[player.id];
            if (newShotCountStr !== undefined) {
                const newShotCount = parseInt(newShotCountStr, 10);
                if (!isNaN(newShotCount)) {
                    return { ...player, shots: newShotCount };
                }
            }
            return player;
        });
        onStatsChange(team, newPlayerStats, periodText);
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
                          <Button variant="outline" size="sm" onClick={handleEditClick}>
                            <Edit3 className="mr-2 h-4 w-4"/>Editar Tiros
                          </Button>
                      )}
                  </div>
                )}
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
                                    const isEditDisabledForThisRow = isEditing && (!player.number);
                                    return (
                                        <TableRow key={player.id} className={cn(isEditDisabledForThisRow && "opacity-50")}>
                                            <TableCell className="font-semibold">{player.number || 'S/N'}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{player.name}</TableCell>
                                            <TableCell className="text-center font-mono">{player.goals || 0}</TableCell>
                                            <TableCell className="text-center font-mono">{player.assists || 0}</TableCell>
                                            <TableCell className="text-center">
                                            {isEditing && editable ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Input
                                                                type="number"
                                                                value={isEditDisabledForThisRow ? String(player.shots || 0) : editedShots[player.id]}
                                                                onChange={(e) => !isEditDisabledForThisRow && handleShotChange(player.id, e.target.value)}
                                                                className={cn("h-7 w-16 mx-auto text-center", isEditDisabledForThisRow && "cursor-not-allowed")}
                                                                disabled={isEditDisabledForThisRow}
                                                            />
                                                        </div>
                                                    </TooltipTrigger>
                                                    {isEditDisabledForThisRow && (
                                                        <TooltipContent>
                                                            <p>No se pueden editar los tiros de un jugador sin número asignado.</p>
                                                        </TooltipContent>
                                                    )}
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

const ShootoutSection = ({ teamName, attempts }: { teamName: string; attempts: ShootoutAttempt[] }) => {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><Swords className="h-5 w-5" />Tiros de Penal (Shootout)</CardTitle>
            </CardHeader>
            <CardContent>
                {attempts.length > 0 ? (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Ronda</TableHead>
                        <TableHead>Jugador</TableHead>
                        <TableHead>Resultado</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {attempts.map(attempt => (
                        <TableRow key={attempt.id}>
                            <TableCell className="font-mono">{attempt.round}</TableCell>
                            <TableCell>
                                <div className="font-semibold">#{attempt.playerNumber}</div>
                                <div className="text-xs text-muted-foreground">{attempt.playerName || '---'}</div>
                            </TableCell>
                            <TableCell>
                                {attempt.isGoal ? <span className="text-green-500 font-bold">Gol</span> : <span className="text-destructive">Atajado/Fallado</span>}
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                ) : <p className="text-sm text-muted-foreground">Sin tiros de penal registrados.</p>}
            </CardContent>
        </Card>
    );
};


export default function ResumenPage() {
  const { state: liveGameState, isLoading } = useGameState();
  const { toast } = useToast();
  
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isAddPenaltyDialogOpen, setIsAddPenaltyDialogOpen] = useState(false);
  const [penaltyContext, setPenaltyContext] = useState<{ team: Team, periodText?: string } | null>(null);
  const [penaltyToDelete, setPenaltyToDelete] = useState<{ team: Team, periodText: string, logId: string } | null>(null);
  const [overwriteConfirm, setOverwriteConfirm] = useState<{ onConfirm: () => void } | null>(null);
  const [unassignedPlayerWarning, setUnassignedPlayerWarning] = useState<{ players: string[]; onConfirm: () => void } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    try {
      const savedSummaryRaw = localStorage.getItem(SUMMARY_DATA_STORAGE_KEY);
      if (savedSummaryRaw) {
        setSummaryData(JSON.parse(savedSummaryRaw));
      }
    } catch (error) {
      console.error("Error loading summary from localStorage:", error);
      localStorage.removeItem(SUMMARY_DATA_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (summaryData) {
      localStorage.setItem(SUMMARY_DATA_STORAGE_KEY, JSON.stringify(summaryData));
    }
  }, [summaryData]);

  const generateSummaryData = useCallback(() => {
    setSummaryData(null); 
    const { live, config } = liveGameState;
    if (!live || !config) return;
    
    const { gameSummary, shootout } = live;

    const statsByPeriod: Record<string, PeriodStats> = {};
    
    const playedPeriodNumbers = new Set<number>();
    
    const lastPlayedPeriodNumber = live.clock.currentPeriod;
    if (lastPlayedPeriodNumber > 0) {
      for (let i = 1; i <= lastPlayedPeriodNumber; i++) {
        playedPeriodNumbers.add(i);
      }
    }
    
    const allEvents = [...gameSummary.home.goals, ...gameSummary.away.goals, ...gameSummary.home.penalties, ...gameSummary.away.penalties];
    allEvents.forEach(event => {
        const periodText = (event as GoalLog).periodText || (event as PenaltyLog).addPeriodText;
        if (periodText && !periodText.toLowerCase().includes('warm-up') && !periodText.toLowerCase().includes('break')) {
             const periodNum = parseInt(periodText.replace(/\D/g, ''), 10);
             if (!isNaN(periodNum) && periodNum > 0) playedPeriodNumbers.add(periodNum);
        }
    });

    const sortedPeriodNumbers = Array.from(playedPeriodNumbers).sort((a,b) => a - b);
    
    const allPeriodTexts = sortedPeriodNumbers
        .map(num => getPeriodText(num, config.numberOfRegularPeriods))
        .filter(text => text && !text.toLowerCase().includes('warm-up') && !text.toLowerCase().includes('break'));


    allPeriodTexts.forEach(period => {
        statsByPeriod[period] = {
            home: { goals: [], penalties: [], playerStats: [] },
            away: { goals: [], penalties: [], playerStats: [] },
        };
        const processTeamPeriod = (team: Team) => {
            const attendance = gameSummary.attendance[team];
            const playerStatsMap = new Map<string, SummaryPlayerStats>();
            attendance.forEach(p => {
                playerStatsMap.set(p.id, { id: p.id, number: p.number, name: p.name, goals: 0, assists: 0, shots: 0 });
            });

            const teamGoals = gameSummary[team].goals.filter(g => g.periodText === period);
            teamGoals.forEach(g => {
                const scorerId = attendance.find(p => p.number === g.scorer?.playerNumber)?.id;
                if (scorerId && playerStatsMap.has(scorerId)) playerStatsMap.get(scorerId)!.goals++;
                
                const assistId = attendance.find(p => p.number === g.assist?.playerNumber)?.id;
                if (assistId && playerStatsMap.has(assistId)) playerStatsMap.get(assistId)!.assists++;
            });

            const shotsLogKey = `${team}ShotsLog` as const;
            const teamShots = (gameSummary[team][shotsLogKey] || []).filter(s => s.periodText === period);

            teamShots.forEach(s => {
                if (s.playerId && playerStatsMap.has(s.playerId)) {
                  playerStatsMap.get(s.playerId)!.shots++;
                }
            });

            const teamPenalties = gameSummary[team].penalties.filter(p => p.addPeriodText === period);
            
            statsByPeriod[period][team] = {
                goals: teamGoals,
                penalties: teamPenalties,
                playerStats: Array.from(playerStatsMap.values())
            };
        };
        processTeamPeriod('home');
        processTeamPeriod('away');
    });

    const newSummaryData: SummaryData = {
        homeTeamName: live.homeTeamName,
        awayTeamName: live.awayTeamName,
        homeScore: live.score.home,
        awayScore: live.score.away,
        categoryName: getCategoryNameById(config.selectedMatchCategory, config.availableCategories) || 'N/A',
        attendance: gameSummary.attendance,
        statsByPeriod,
        shootout: shootout.isActive ? shootout : undefined,
    };
    setSummaryData(newSummaryData);
    toast({ title: "Resumen Generado", description: "Se han cargado los datos del partido actual." });

  }, [liveGameState, toast]);

  const handleGenerateSummaryClick = () => {
    const unassignedHome = liveGameState.live.gameSummary.attendance.home.filter(p => !p.number).map(p => p.name);
    const unassignedAway = liveGameState.live.gameSummary.attendance.away.filter(p => !p.number).map(p => p.name);
    const allUnassigned = [...unassignedHome, ...unassignedAway];

    const confirmAndGenerate = () => {
      if (allUnassigned.length > 0) {
        setUnassignedPlayerWarning({ players: allUnassigned, onConfirm: generateSummaryData });
      } else {
        generateSummaryData();
      }
    };
    
    if (summaryData) {
      setOverwriteConfirm({ onConfirm: confirmAndGenerate });
    } else {
      confirmAndGenerate();
    }
  };

  const getAggregateStats = useCallback((team: Team): { goals: GoalLog[], penalties: PenaltyLog[], playerStats: SummaryPlayerStats[] } => {
    if (!summaryData) return { goals: [], penalties: [], playerStats: [] };

    const allGoals: GoalLog[] = [];
    const allPenalties: PenaltyLog[] = [];
    const playerStatsMap = new Map<string, SummaryPlayerStats>();
    
    summaryData.attendance[team].forEach(p => {
        playerStatsMap.set(p.id, { id: p.id, number: p.number, name: p.name, goals: 0, assists: 0, shots: 0 });
    });

    Object.values(summaryData.statsByPeriod).forEach(periodStats => {
        if (periodStats[team]?.goals) allGoals.push(...periodStats[team].goals);
        if (periodStats[team]?.penalties) allPenalties.push(...periodStats[team].penalties);
        
        if (periodStats[team]?.playerStats) {
            periodStats[team].playerStats.forEach(pStat => {
                if (playerStatsMap.has(pStat.id)) {
                    const totalStat = playerStatsMap.get(pStat.id)!;
                    totalStat.goals += pStat.goals;
                    totalStat.assists += pStat.assists;
                    totalStat.shots += pStat.shots;
                }
            });
        }
    });

    return {
        goals: allGoals.sort((a, b) => a.timestamp - b.timestamp),
        penalties: allPenalties.sort((a, b) => a.addTimestamp - b.addTimestamp),
        playerStats: Array.from(playerStatsMap.values()),
    };
  }, [summaryData]);
  
  const homeAggregatedStats = useMemo(() => getAggregateStats('home'), [getAggregateStats, summaryData]);
  const awayAggregatedStats = useMemo(() => getAggregateStats('away'), [getAggregateStats, summaryData]);

  const handleSaveAndExport = async () => {
    if (!summaryData) {
        toast({
            title: "No hay resumen",
            description: "Genera un resumen antes de guardarlo o exportarlo.",
            variant: "destructive"
        });
        return;
    }

    setIsSaving(true);
    toast({ title: "Procesando...", description: "Guardando resúmenes y generando PDF." });

    // 1. Export PDF
    const pdfFilename = exportGameSummaryPDF(liveGameState);

    // 2. Prepare data and save CSVs
    const getResult = (teamScore: number, opponentScore: number): "Ganó" | "Perdió" | "Empató" => {
        if (teamScore > opponentScore) return "Ganó";
        if (teamScore < opponentScore) return "Perdió";
        return "Empató";
    };

    const homeCsvPayload = {
        teamName: summaryData.homeTeamName,
        categoryName: summaryData.categoryName,
        gameResult: getResult(summaryData.homeScore, summaryData.awayScore),
        goalsFor: summaryData.homeScore,
        goalsAgainst: summaryData.awayScore,
        playerStats: homeAggregatedStats.playerStats.map(p => ({
            number: p.number, name: p.name, goals: p.goals, assists: p.assists, shots: p.shots
        }))
    };
    
    const awayCsvPayload = {
        teamName: summaryData.awayTeamName,
        categoryName: summaryData.categoryName,
        gameResult: getResult(summaryData.awayScore, summaryData.homeScore),
        goalsFor: summaryData.awayScore,
        goalsAgainst: summaryData.homeScore,
        playerStats: awayAggregatedStats.playerStats.map(p => ({
            number: p.number, name: p.name, goals: p.goals, assists: p.assists, shots: p.shots
        }))
    };

    try {
        const [homeResult, awayResult] = await Promise.all([
            saveTeamCsvSummary(homeCsvPayload),
            saveTeamCsvSummary(awayCsvPayload)
        ]);

        if (homeResult.success && awayResult.success) {
            toast({
                title: "Éxito",
                description: `PDF generado (${pdfFilename}) y resúmenes CSV guardados en el servidor.`,
            });
        } else {
            throw new Error(`CSV Home: ${homeResult.message}, CSV Away: ${awayResult.message}`);
        }
    } catch (error) {
        console.error("Error saving summaries:", error);
        toast({
            title: "Error al Guardar CSVs",
            description: "El PDF se generó, pero hubo un error al guardar los archivos CSV en el servidor.",
            variant: "destructive"
        });
    } finally {
        setIsSaving(false);
    }
};

  
  const handleOpenAddPenalty = (team: Team, periodText?: string) => {
    setPenaltyContext({ team, periodText });
    setIsAddPenaltyDialogOpen(true);
  };
  
  const handleConfirmAddPenalty = (team: Team, playerNumber: string, penaltyTypeId: string, gameTimeCs: number, periodText: string) => {
    if (!summaryData) return;
    
    const penaltyDef = liveGameState.config.penaltyTypes.find(p => p.id === penaltyTypeId);
    if (!penaltyDef) return;

    const teamData = liveGameState.config.teams.find(t => t.name === summaryData[`${team}TeamName`] && t.category === summaryData.categoryName);
    const playerDetails = teamData?.players.find(p => p.number === playerNumber);

    const newPenaltyLog: PenaltyLog = {
        id: safeUUID(), team, playerNumber, playerName: playerDetails?.name, penaltyName: penaltyDef.name,
        initialDuration: penaltyDef.duration, reducesPlayerCount: penaltyDef.reducesPlayerCount,
        clearsOnGoal: penaltyDef.clearsOnGoal, isBenchPenalty: penaltyDef.isBenchPenalty,
        addTimestamp: Date.now(), addGameTime: gameTimeCs, addPeriodText: periodText,
    };

    setSummaryData(prev => {
        if (!prev) return null;
        const newSummary: SummaryData = JSON.parse(JSON.stringify(prev));
        
        if (!newSummary.statsByPeriod[periodText]) {
            newSummary.statsByPeriod[periodText] = { 
                home: { goals: [], penalties: [], playerStats: [] }, 
                away: { goals: [], penalties: [], playerStats: [] } 
            };
        } else if (!newSummary.statsByPeriod[periodText][team]) {
             newSummary.statsByPeriod[periodText][team] = { goals: [], penalties: [], playerStats: [] };
        }
        
        if (!newSummary.statsByPeriod[periodText][team].penalties) newSummary.statsByPeriod[periodText][team].penalties = [];
        if (!newSummary.statsByPeriod[periodText][team].goals) newSummary.statsByPeriod[periodText][team].goals = [];
        if (!newSummary.statsByPeriod[periodText][team].playerStats) newSummary.statsByPeriod[periodText][team].playerStats = [];

        newSummary.statsByPeriod[periodText][team].penalties.push(newPenaltyLog);
        newSummary.statsByPeriod[periodText][team].penalties.sort((a: PenaltyLog, b: PenaltyLog) => a.addTimestamp - b.addTimestamp);
        return newSummary;
    });
    
    toast({ title: "Penalidad Añadida", description: "La penalidad se ha agregado al resumen."});
    setIsAddPenaltyDialogOpen(false);
    setPenaltyContext(null);
  };

  const handlePrepareDeletePenalty = (team: Team, periodText: string, logId: string) => {
      setPenaltyToDelete({ team, periodText, logId });
  };
  
  const handleConfirmDeletePenalty = () => {
      if (penaltyToDelete && summaryData) {
        setSummaryData(prev => {
            if (!prev) return null;
            const { team, periodText, logId } = penaltyToDelete;
            const newSummary: SummaryData = JSON.parse(JSON.stringify(prev));
            if (newSummary.statsByPeriod[periodText]) {
              newSummary.statsByPeriod[periodText][team].penalties = newSummary.statsByPeriod[periodText][team].penalties.filter((p: PenaltyLog) => p.id !== logId);
            }
            return newSummary;
        });
        toast({ title: "Penalidad Eliminada", variant: "destructive" });
        setPenaltyToDelete(null);
      }
  };

  const handleStatsChange = (team: Team, newStats: SummaryPlayerStats[], period: string) => {
    setSummaryData(prev => {
        if (!prev) return null;
        const newSummary: SummaryData = JSON.parse(JSON.stringify(prev));
        if (newSummary.statsByPeriod[period]) {
            newSummary.statsByPeriod[period][team].playerStats = newStats;
        }
        return newSummary;
    });
  };

  const allPeriodTexts = useMemo(() => {
    if (!summaryData) return [];
    
    const getPeriodSortValue = (periodText: string): number => {
        if (!periodText) return 999;
        if (periodText.toUpperCase().startsWith('SHOOTOUT') || periodText.toUpperCase().startsWith('PENALES')) return 1000;
        if (periodText.toUpperCase().startsWith('OT')) {
            const numPart = periodText.replace(/\D/g, '');
            const otNumber = numPart ? parseInt(numPart, 10) : 1;
            return (liveGameState.config?.numberOfRegularPeriods || 0) + otNumber;
        }
        const num = parseInt(periodText.replace(/\D/g, ''), 10);
        return isNaN(num) ? 999 : num;
    };
    
    const periods = new Set(Object.keys(summaryData.statsByPeriod));
    if (summaryData.shootout && summaryData.shootout.isActive) {
        periods.add("Shootout");
    }

    return Array.from(periods).sort((a, b) => getPeriodSortValue(a) - getPeriodSortValue(b));
  }, [summaryData, liveGameState.config?.numberOfRegularPeriods]);


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
        <div className="flex flex-wrap justify-between items-center gap-4">
            <h1 className="text-3xl font-bold text-primary-foreground">Resumen del Partido</h1>
            <div className="flex gap-2">
                <Button onClick={handleGenerateSummaryClick} variant="outline"><RefreshCw className="mr-2 h-4 w-4"/> Recargar Datos del Partido</Button>
                <Button onClick={handleSaveAndExport} disabled={!summaryData || isSaving}>
                    {isSaving ? <HockeyPuckSpinner className="mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4"/>}
                    Guardar y Exportar Resumen
                </Button>
            </div>
        </div>

        {!summaryData ? (
             <Card className="text-center py-20">
                <CardContent>
                    <Info className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h2 className="text-xl font-semibold">Resumen no generado</h2>
                    <p className="text-muted-foreground">Haz clic en "Recargar Datos" para cargar las estadísticas del partido actual.</p>
                </CardContent>
            </Card>
        ) : (
            <>
                <div className="grid grid-cols-2 text-center my-2">
                    <h3 className="text-2xl font-bold text-primary">{summaryData.homeTeamName} - <span className="text-accent">{summaryData.homeScore}</span></h3>
                    <h3 className="text-2xl font-bold text-primary">{summaryData.awayTeamName} - <span className="text-accent">{summaryData.awayScore}</span></h3>
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
                                    <GoalsSection teamName={summaryData.homeTeamName} goals={homeAggregatedStats.goals} />
                                    <GoalsSection teamName={summaryData.awayTeamName} goals={awayAggregatedStats.goals} />
                                </div>
                                <Separator />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                     <PenaltiesSection team="home" teamName={summaryData.homeTeamName} penalties={homeAggregatedStats.penalties} />
                                     <PenaltiesSection team="away" teamName={summaryData.awayTeamName} penalties={awayAggregatedStats.penalties} />
                                </div>
                                
                                {summaryData.shootout && summaryData.shootout.isActive && (
                                    <>
                                        <Separator />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <ShootoutSection teamName={summaryData.homeTeamName} attempts={summaryData.shootout.homeAttempts} />
                                            <ShootoutSection teamName={summaryData.awayTeamName} attempts={summaryData.shootout.awayAttempts} />
                                        </div>
                                    </>
                                )}
                                <Separator />
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <PlayerStatsSection team="home" teamName={summaryData.homeTeamName} playerStats={homeAggregatedStats.playerStats} editable={false} />
                                    <PlayerStatsSection team="away" teamName={summaryData.awayTeamName} playerStats={awayAggregatedStats.playerStats} editable={false} />
                                </div>
                            </div>
                        </ScrollArea>
                    </TabsContent>
                    <TabsContent value="periods" className="mt-6">
                        <ScrollArea className="h-[calc(100vh-22rem)]">
                            <Accordion type="single" collapsible className="w-full pr-4">
                                {allPeriodTexts.map(periodText => {
                                    if (periodText.toUpperCase() === 'SHOOTOUT') {
                                        if (!summaryData.shootout || !summaryData.shootout.isActive) return null;
                                        return (
                                            <AccordionItem value="shootout" key="shootout">
                                                <AccordionTrigger className="text-xl hover:no-underline">Shootout</AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="space-y-8 pl-2">
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <ShootoutSection teamName={summaryData.homeTeamName} attempts={summaryData.shootout.homeAttempts} />
                                                            <ShootoutSection teamName={summaryData.awayTeamName} attempts={summaryData.shootout.awayAttempts} />
                                                        </div>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    }

                                    const periodData = summaryData.statsByPeriod[periodText];
                                    if (!periodData) return null;

                                    return (
                                        <AccordionItem value={periodText} key={periodText}>
                                            <AccordionTrigger className="text-xl hover:no-underline">{periodText}</AccordionTrigger>
                                            <AccordionContent>
                                                <div className="space-y-8 pl-2">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <GoalsSection teamName={summaryData.homeTeamName} goals={periodData.home.goals} />
                                                        <GoalsSection teamName={summaryData.awayTeamName} goals={periodData.away.goals} />
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <PenaltiesSection team="home" teamName={summaryData.homeTeamName} penalties={periodData.home.penalties} onAdd={() => handleOpenAddPenalty('home', periodText)} onDelete={(logId) => handlePrepareDeletePenalty('home', periodText, logId)} />
                                                        <PenaltiesSection team="away" teamName={summaryData.awayTeamName} penalties={periodData.away.penalties} onAdd={() => handleOpenAddPenalty('away', periodText)} onDelete={(logId) => handlePrepareDeletePenalty('away', periodText, logId)} />
                                                    </div>
                                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <PlayerStatsSection 
                                                            team="home" 
                                                            teamName={summaryData.homeTeamName} 
                                                            playerStats={periodData.home.playerStats} 
                                                            editable={true} 
                                                            onStatsChange={handleStatsChange}
                                                            periodText={periodText}
                                                        />
                                                        <PlayerStatsSection 
                                                            team="away" 
                                                            teamName={summaryData.awayTeamName} 
                                                            playerStats={periodData.away.playerStats} 
                                                            editable={true} 
                                                            onStatsChange={handleStatsChange}
                                                            periodText={periodText}
                                                        />
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
                        availablePeriods={allPeriodTexts.filter(p => p !== 'Shootout')}
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
                    <AlertTitle className="flex items-center gap-2"><AlertTriangle className="text-amber-500" /> Confirmar Recarga de Datos</AlertTitle>
                    <AlertDialogDesc>
                        Ya existe un resumen generado. Si continúas, se perderán todos los cambios manuales que hayas hecho en este resumen. ¿Deseas continuar y reemplazar los datos?
                    </AlertDialogDesc>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setOverwriteConfirm(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { overwriteConfirm.onConfirm(); setOverwriteConfirm(null); }}>
                            Sí, Recargar Datos
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
                    <p className="text-sm text-muted-foreground mt-2">
                        ¿Deseas generar el resumen de todas formas?
                    </p>
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
    

    












    


    

    

    


