
"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import type { SummaryPlayerStats } from "@/types";
import { BarChart3 } from "lucide-react";
import { Input } from "@/components/ui/input";

export const PlayerStatsSection = ({ 
    teamName, 
    playerStats, 
    editable,
    editedShots,
    onShotChange
}: { 
    teamName: string; 
    playerStats?: SummaryPlayerStats[]; 
    editable?: boolean;
    editedShots?: Record<string, string>;
    onShotChange?: (playerId: string, value: string) => void;
}) => {
    
    const sortedPlayers = useMemo(() => {
        if (!playerStats) return [];
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
        return sortedPlayers.reduce((acc, player) => {
            acc.goals += player.goals || 0;
            acc.assists += player.assists || 0;
            const shotsValue = editable && editedShots ? (parseInt(editedShots[player.id], 10) || 0) : (player.shots || 0);
            acc.shots += shotsValue;
            return acc;
        }, { goals: 0, assists: 0, shots: 0 });
    }, [sortedPlayers, editable, editedShots]);
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl"><BarChart3 className="h-5 w-5" />Estadísticas - {teamName}</CardTitle>
            </CardHeader>
            <CardContent>
                    {sortedPlayers.length > 0 ? (
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
                                {sortedPlayers.map(player => (
                                    <TableRow key={player.id}>
                                        <TableCell className="font-semibold">{player.number || 'S/N'}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{player.name}</TableCell>
                                        <TableCell className="text-center font-mono">{player.goals || 0}</TableCell>
                                        <TableCell className="text-center font-mono">{player.assists || 0}</TableCell>
                                        <TableCell className="text-center">
                                        {editable ? (
                                            <Input
                                                type="number"
                                                value={editedShots?.[player.id] || String(player.shots || '0')}
                                                onChange={(e) => onShotChange?.(player.id, e.target.value)}
                                                className="h-7 w-14 text-center"
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
