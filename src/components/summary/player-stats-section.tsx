
"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import type { AttendedPlayerInfo, SummaryPlayerStats, Team, PlayerData } from "@/types";
import { BarChart3, Edit3, Check, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const PlayerStatsSection = ({ team, teamName, playerStats, attendance, onStatsChange, editable, periodText }: { team: Team; teamName: string; playerStats?: SummaryPlayerStats[]; attendance?: AttendedPlayerInfo[]; editable?: boolean; periodText?: string, onStatsChange?: (team: Team, newStats: SummaryPlayerStats[], period: string) => void }) => {
    
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

    const handleCancelClick = () => setIsEditing(false);

    const handleSaveClick = () => {
        if (!onStatsChange || !periodText || !playerStats) return;

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
