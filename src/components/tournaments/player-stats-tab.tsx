
"use client";

import React, { useMemo, useState } from 'react';
import { useGameState } from '@/contexts/game-state-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Info } from 'lucide-react';
import { usePlayerStats } from '@/hooks/use-player-stats';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';

const ALL_CATEGORIES = "__ALL__";

export function PlayerStatsTab() {
  const { state } = useGameState();
  const { tournaments, selectedTournamentId } = state.config;

  const selectedTournament = useMemo(() => {
    return (tournaments || []).find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES);
  const playerStats = usePlayerStats(selectedTournament, categoryFilter === ALL_CATEGORIES ? null : categoryFilter);

  if (!selectedTournament) return null;

  return (
    <div className="space-y-8">
        <div className="flex items-start gap-2 p-3 text-sm border rounded-lg bg-muted/50 text-muted-foreground">
            <Info className="h-5 w-5 mt-0.5 shrink-0"/>
            <p>El sistema de puntos es: 2 puntos por gol, 1 punto por asistencia. Las penalidades no afectan el puntaje.</p>
        </div>

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-2xl">
                    <Trophy className="h-6 w-6 text-amber-400" />
                    Estadísticas de Jugadores
                </CardTitle>
                <div className="w-56">
                    <Label>Filtrar por Categoría</Label>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_CATEGORIES}>Todas las Categorías</SelectItem>
                            {(selectedTournament.categories || []).map(cat => (
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="text-center w-16">Puesto</TableHead>
                            <TableHead>Jugador</TableHead>
                            <TableHead>Equipo</TableHead>
                            <TableHead className="text-center">G</TableHead>
                            <TableHead className="text-center">A</TableHead>
                            <TableHead className="text-center"># Pen.</TableHead>
                            <TableHead className="text-center">T. Pen. (min)</TableHead>
                            <TableHead className="text-center font-bold">Puntos</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {playerStats.map(stat => (
                            <TableRow key={stat.playerId}>
                                <TableCell className="text-center font-bold">{stat.rank}</TableCell>
                                <TableCell className="font-medium">{stat.playerName}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{stat.teamName}</TableCell>
                                <TableCell className="text-center font-mono">{stat.goals}</TableCell>
                                <TableCell className="text-center font-mono">{stat.assists}</TableCell>
                                <TableCell className="text-center font-mono">{stat.penaltyCount}</TableCell>
                                <TableCell className="text-center font-mono">{stat.penaltyMinutes.toFixed(1)}</TableCell>
                                <TableCell className="text-center font-bold text-lg">{stat.points}</TableCell>
                            </TableRow>
                        ))}
                         {playerStats.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center">No hay estadísticas para mostrar.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    </div>
  );
}
