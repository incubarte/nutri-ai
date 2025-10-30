
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import type { AttendedPlayerInfo, SummaryPlayerStats, Team, PlayerData } from "@/types";
import { BarChart3, Edit3, Check, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGameState } from "@/contexts/game-state-context";
import { useToast } from "@/hooks/use-toast";


export const PlayerStatsSection = ({ team, teamName, playerStats, attendance, editable, periodText, onEdit }: { team: Team; teamName: string; playerStats?: SummaryPlayerStats[]; attendance?: AttendedPlayerInfo[]; editable?: boolean; periodText?: string, onEdit?: () => void }) => {
    const { dispatch } = useGameState();
    const { toast } = useToast();
    const [isEditing, setIsEditing] = useState(false);
    const [editedShots, setEditedShots] = useState<Record<string, string>>({});

    const attendedPlayersWithStats = useMemo(() => {
        const statsToUse = playerStats || [];
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
        
        statsToUse.forEach(pStat => {
             const playerInAttendance = attendanceToUse.find(p => p.id === pStat.id);
            if(playerInAttendance) {
                const existingPlayer = playerMap.get(playerInAttendance.id);
                if (existingPlayer) {
                    playerMap.set(existingPlayer.id, {
                        ...existingPlayer,
                        shots: pStat.shots || 0,
                        goals: pStat.goals || 0,
                        assists: pStat.assists || 0,
                    });
                }
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
            const shotsValue = isEditing ? (parseInt(editedShots[player.id], 10) || 0) : (player.shots || 0);
            acc.shots += shotsValue;
            return acc;
        }, { goals: 0, assists: 0, shots: 0 });
    }, [attendedPlayersWithStats, isEditing, editedShots]);

    const handleEditClick = () => {
        const initialShots = attendedPlayersWithStats.reduce((acc, player) => {
            acc[player.id] = String(player.shots || 0);
            return acc;
        }, {} as Record<string, string>);
        setEditedShots(initialShots);
        setIsEditing(true);
    };

    const handleCancelClick = () => setIsEditing(false);

    const handleSaveClick = () => {
        if (!periodText || !onEdit) return;

        let changesCount = 0;
        for (const playerId in editedShots) {
            const originalPlayer = attendedPlayersWithStats.find(p => p.id === playerId);
            const originalShots = originalPlayer?.shots || 0;
            const newShotCount = parseInt(editedShots[playerId], 10);

            if (isNaN(newShotCount) || newShotCount < 0) {
                 toast({ title: "Valor inválido", description: `El número de tiros para #${originalPlayer?.number} debe ser un número positivo.`, variant: "destructive" });
                 return;
            }
            
            if (newShotCount !== originalShots) {
                dispatch({
                    type: 'SET_PLAYER_SHOTS',
                    payload: { team, playerId, periodText, shotCount: newShotCount }
                });
                changesCount++;
            }
        }
        
        if (changesCount > 0) {
            toast({ title: "Tiros actualizados", description: `Se guardaron los cambios de tiros en ${periodText}.` });
        } else {
            toast({ title: "Sin cambios", description: "No se detectaron cambios en los tiros." });
        }
        
        onEdit();
        setIsEditing(false);
    };

    const handleShotInputChange = (playerId: string, value: string) => {
        setEditedShots(prev => ({ ...prev, [playerId]: value }));
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
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleCancelClick}><XCircle className="h-5 w-5" /></Button>
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
                                {attendedPlayersWithStats.map(player => {
                                    const isEditDisabledForThisRow = isEditing && !player.number;
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
                                                                value={editedShots[player.id] || '0'}
                                                                onChange={(e) => handleShotInputChange(player.id, e.target.value)}
                                                                className="h-7 w-14 text-center disabled:cursor-not-allowed"
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
