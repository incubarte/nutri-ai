

"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import type { SummaryPlayerStats, PlayerData, AttendedPlayerInfo } from "@/types";
import { BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const PlayerStatsSection = ({ 
    teamName, 
    allPlayers,
    playerStats, 
    attendance,
    editable,
    editedShots,
    onShotChange
}: { 
    teamName: string; 
    allPlayers?: PlayerData[];
    playerStats?: SummaryPlayerStats[]; 
    attendance?: AttendedPlayerInfo[];
    editable?: boolean;
    editedShots?: Record<string, string>;
    onShotChange?: (playerId: string, value: string) => void;
}) => {
    
    const sortedPlayersWithStats = useMemo(() => {
        const fullRoster = allPlayers || [];
        const attendanceSet = new Set((attendance || []).map(p => p.id));
        const statsMap = new Map<string, SummaryPlayerStats>();

        // Pre-populate map with stats
        (playerStats || []).forEach(pStat => {
            statsMap.set(pStat.id, pStat);
        });

        const combinedList = fullRoster.map(player => {
            const stats = statsMap.get(player.id);
            return {
                ...player,
                goals: stats?.goals || 0,
                assists: stats?.assists || 0,
                shots: stats?.shots || 0,
                attended: attendanceSet.has(player.id)
            };
        });

        return combinedList.sort((a, b) => {
            const numA = parseInt(a.number, 10);
            const numB = parseInt(b.number, 10);

            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (isNaN(numA) && !isNaN(numB)) return 1;
            if (!isNaN(numA) && isNaN(numB)) return -1;
            return a.name.localeCompare(b.name);
        });
    }, [allPlayers, playerStats, attendance]);

    const totals = useMemo(() => {
        return sortedPlayersWithStats.reduce((acc, player) => {
            if (player.attended) {
                acc.goals += player.goals || 0;
                acc.assists += player.assists || 0;
                const shotsValue = editable && editedShots ? (parseInt(editedShots[player.id], 10) || 0) : (player.shots || 0);
                acc.shots += shotsValue;
            }
            return acc;
        }, { goals: 0, assists: 0, shots: 0 });
    }, [sortedPlayersWithStats, editable, editedShots]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><BarChart3 className="h-5 w-5" />Estadísticas - {teamName}</CardTitle>
            </CardHeader>
            <CardContent>
                {sortedPlayersWithStats.length > 0 ? (
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
                            {sortedPlayersWithStats.map(player => (
                                <TableRow key={player.id} className={cn(!player.attended && "text-muted-foreground opacity-60")}>
                                    <TableCell className="font-semibold">{player.number || 'S/N'}</TableCell>
                                    <TableCell className="text-xs">{player.name}</TableCell>
                                    <TableCell className="text-center font-mono">{player.goals || 0}</TableCell>
                                    <TableCell className="text-center font-mono">{player.assists || 0}</TableCell>
                                    <TableCell className="text-center">
                                    {editable ? (
                                        <Input
                                            type="number"
                                            value={editedShots?.[player.id] ?? ''}
                                            onChange={(e) => onShotChange?.(player.id, e.target.value)}
                                            className="h-7 w-14 text-center mx-auto"
                                            disabled={!player.attended}
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
                    <p className="text-sm text-muted-foreground">Este equipo no tiene jugadores registrados.</p>
                )}
            </CardContent>
        </Card>
    );
};
