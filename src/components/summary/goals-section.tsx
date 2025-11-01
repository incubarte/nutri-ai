
"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as UiTableFooter } from "@/components/ui/table";
import { formatTime } from "@/contexts/game-state-context";
import type { GoalLog, PlayerData } from "@/types";
import { Goal, PlusCircle, Trash2, Edit3, Check, XCircle } from "lucide-react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { safeUUID } from '@/lib/utils';
import { Label } from '../ui/label';

interface EditableGoalRowProps {
    goal: GoalLog;
    players: PlayerData[];
    onSave: (updatedGoal: GoalLog) => void;
    onCancel: () => void;
    onDelete: (goalId: string) => void;
}

const EditableGoalRow = ({ goal, players, onSave, onCancel, onDelete }: EditableGoalRowProps) => {
    const [scorerNumber, setScorerNumber] = useState(goal.scorer?.playerNumber || '');
    const [assistNumber, setAssistNumber] = useState(goal.assist?.playerNumber || '');
    
    const validPlayers = players.filter(p => p.number && p.number.trim() !== '');

    const handleSave = () => {
        const scorer = players.find(p => p.number === scorerNumber);
        const assist = players.find(p => p.number === assistNumber);
        
        onSave({
            ...goal,
            scorer: scorer ? { playerNumber: scorer.number, playerName: scorer.name } : { playerNumber: scorerNumber },
            assist: assist ? { playerNumber: assist.number, playerName: assist.name } : (assistNumber ? { playerNumber: assistNumber } : undefined)
        });
    };

    return (
        <TableRow>
            <TableCell>{goal.periodText} {formatTime(goal.gameTime)}</TableCell>
            <TableCell>
                <Select value={scorerNumber} onValueChange={setScorerNumber}>
                    <SelectTrigger><SelectValue placeholder="Goleador" /></SelectTrigger>
                    <SelectContent>
                        {validPlayers.map(p => <SelectItem key={p.id} value={p.number}>#{p.number} {p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell>
                <Select value={assistNumber} onValueChange={(value) => setAssistNumber(value === "no-assist" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Asistente" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="no-assist">-- Sin Asistencia --</SelectItem>
                        {validPlayers.map(p => <SelectItem key={p.id} value={p.number} disabled={p.number === scorerNumber}>#{p.number} {p.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell className="text-right">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500" onClick={handleSave}><Check className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onCancel}><XCircle className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(goal.id)}><Trash2 className="h-4 w-4" /></Button>
            </TableCell>
        </TableRow>
    );
};

export const GoalsSection = ({ teamName, goals, onGoalChange, editable, players }: { teamName: string; goals: GoalLog[]; onGoalChange?: (action: 'add' | 'update' | 'delete', goal: GoalLog, originalId?: string) => void; editable?: boolean; players?: PlayerData[] }) => {
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const safeGoals = goals || [];

    const handleSaveGoal = (updatedGoal: GoalLog) => {
        const isNew = !safeGoals.some(g => g.id === updatedGoal.id);
        if (onGoalChange) {
            if (isNew) {
                onGoalChange('add', updatedGoal);
            } else {
                onGoalChange('update', updatedGoal, updatedGoal.id);
            }
        }
        setIsAdding(false);
        setEditingGoalId(null);
    };

    const handleDeleteGoal = (goalId: string) => {
        const goalToDelete = safeGoals.find(g => g.id === goalId);
        if (goalToDelete && onGoalChange) {
            onGoalChange('delete', goalToDelete, goalId);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-xl"><Goal className="h-5 w-5" />Goles</CardTitle>
                {editable && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => setIsAdding(true)}>
                        <PlusCircle className="h-5 w-5" />
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Tiempo</TableHead>
                            <TableHead>Gol</TableHead>
                            <TableHead>Asistencia</TableHead>
                            {editable && <TableHead className="text-right">Acciones</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isAdding && players && (
                            <EditableGoalRow goal={{id: `new-${safeUUID()}`, team: 'home', timestamp:0, gameTime: 0, periodText: ''}} players={players} onSave={handleSaveGoal} onCancel={() => setIsAdding(false)} onDelete={() => {}} />
                        )}
                        {safeGoals.length > 0 ? safeGoals.map(goal => (
                            editingGoalId === goal.id && players ? (
                                <EditableGoalRow key={goal.id} goal={goal} players={players} onSave={handleSaveGoal} onCancel={() => setEditingGoalId(null)} onDelete={handleDeleteGoal}/>
                            ) : (
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
                                    {editable && (
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingGoalId(goal.id)}><Edit3 className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGoal(goal.id)}><Trash2 className="h-4 w-4" /></Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            )
                        )) : !isAdding && (
                            <TableRow>
                                <TableCell colSpan={editable ? 4 : 3} className="h-16 text-center text-sm text-muted-foreground">Sin goles registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    {safeGoals.length > 0 && (
                        <UiTableFooter>
                            <TableRow>
                                <TableCell colSpan={editable ? 4 : 3} className="text-right font-bold">Total Goles: {safeGoals.length}</TableCell>
                            </TableRow>
                        </UiTableFooter>
                    )}
                </Table>
            </CardContent>
        </Card>
    );
};
