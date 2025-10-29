
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ShootoutAttempt } from "@/types";
import { Check, X, Swords } from "lucide-react";

export const ShootoutSection = ({ teamName, attempts }: { teamName: string; attempts: ShootoutAttempt[] }) => {
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
                                {attempt.isGoal ? <span className="text-green-500 font-bold flex items-center gap-1"><Check className="h-4 w-4"/> Gol</span> : <span className="text-destructive flex items-center gap-1"><X className="h-4 w-4"/> Fallado</span>}
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
