
"use client";

import React, { useState, useMemo } from 'react';
import { useGameState, type Team, type PlayerData, type ShootoutAttempt } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Swords, Check, X, Shield, Goal, Flag, Undo2 } from 'lucide-react';
import { Separator } from '../ui/separator';

const PlayerSelector = ({ team, onSelect, disabled, existingAttempts }: { team: Team, onSelect: (player: PlayerData) => void, disabled: boolean, existingAttempts: ShootoutAttempt[] }) => {
    const { state } = useGameState();
    const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");

    const teamData = useMemo(() => {
        const teamDetails = state.config.teams.find(t =>
            t.name === state.live[`${team}TeamName`] &&
            (t.subName || undefined) === (state.live[`${team}TeamSubName`] || undefined) &&
            t.category === state.config.selectedMatchCategory
        );
        return teamDetails || null;
    }, [state.config, state.live, team]);

    const availablePlayers = useMemo(() => {
        if (!teamData) return [];
        const attemptedPlayerIds = new Set(existingAttempts.map(a => a.playerId));
        return teamData.players.filter(p => !attemptedPlayerIds.has(p.id));
    }, [teamData, existingAttempts]);

    const handleSelectChange = (playerId: string) => {
        const player = teamData?.players.find(p => p.id === playerId);
        if (player) {
            setSelectedPlayerId(playerId);
            onSelect(player);
        }
    };

    return (
        <Select value={selectedPlayerId} onValueChange={handleSelectChange} disabled={disabled || availablePlayers.length === 0}>
            <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleccionar Jugador..." />
            </SelectTrigger>
            <SelectContent>
                {availablePlayers.length > 0 ? availablePlayers.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                        #{p.number || 'S/N'} - {p.name}
                    </SelectItem>
                )) : (
                    <div className="text-sm text-muted-foreground p-2">No hay más jugadores disponibles</div>
                )}
            </SelectContent>
        </Select>
    );
};

const ShootoutAttemptRow = ({ attempt }: { attempt: ShootoutAttempt }) => (
    <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
        <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground w-6 text-center">R{attempt.round}</span>
            <p className="text-sm font-medium">#{attempt.playerNumber} - {attempt.playerName}</p>
        </div>
        {attempt.isGoal === true && <Check className="h-5 w-5 text-green-500" />}
        {attempt.isGoal === false && <X className="h-5 w-5 text-destructive" />}
    </div>
);


export const ShootoutControl = () => {
    const { state, dispatch } = useGameState();
    const { toast } = useToast();
    const { shootout, homeTeamName, awayTeamName, score } = state.live;
    const [homeSelection, setHomeSelection] = useState<PlayerData | null>(null);
    const [awaySelection, setAwaySelection] = useState<PlayerData | null>(null);

    const homeGoals = shootout?.homeAttempts.filter(a => a.isGoal).length || 0;
    const awayGoals = shootout?.awayAttempts.filter(a => a.isGoal).length || 0;
    const currentRound = Math.max(shootout?.homeAttempts.length || 0, shootout?.awayAttempts.length || 0) + 1;

    const gameIsDecided = useMemo(() => {
        if (!shootout) return false;
        const roundsLeft = shootout.rounds - (currentRound - 1);
        return Math.abs(homeGoals - awayGoals) > roundsLeft;
    }, [shootout, homeGoals, awayGoals, currentRound]);

    const handleRecordAttempt = (team: Team, isGoal: boolean) => {
        const player = team === 'home' ? homeSelection : awaySelection;
        if (!player) {
            toast({ title: "Jugador no seleccionado", description: `Por favor, selecciona un jugador para el equipo ${team === 'home' ? homeTeamName : awayTeamName}.`, variant: "destructive" });
            return;
        }

        dispatch({ type: 'RECORD_SHOOTOUT_ATTEMPT', payload: { team, playerId: player.id, playerNumber: player.number, playerName: player.name, isGoal } });

        if (team === 'home') setHomeSelection(null);
        if (team === 'away') setAwaySelection(null);
    };

    const handleFinishShootout = () => {
        dispatch({ type: 'FINISH_SHOOTOUT' });
        toast({ title: "Tanda de Penales Finalizada", description: "El resultado final ha sido actualizado." });
    };

    if (!shootout || !shootout.isActive) {
        return null;
    }

    return (
        <Card className="w-full max-w-4xl mx-auto shadow-xl border-indigo-500/50">
            <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3 text-indigo-400">
                    <Swords className="h-7 w-7" />
                    Control de Tanda de Penales
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                        <p className="font-bold text-lg truncate">{homeTeamName}</p>
                        <p className="text-6xl font-bold text-accent">{score.home + homeGoals}</p>
                    </div>
                    <div>
                        <p className="font-bold text-lg truncate">{awayTeamName}</p>
                        <p className="text-6xl font-bold text-accent">{score.away + awayGoals}</p>
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <h3 className="text-xl font-semibold text-center">Ronda {currentRound}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Home Team Shooter */}
                        <div className="space-y-3 p-4 border rounded-lg">
                            <h4 className="font-medium text-center">{homeTeamName}</h4>
                            <PlayerSelector team="home" onSelect={setHomeSelection} disabled={gameIsDecided} existingAttempts={shootout.homeAttempts} />
                            <div className="grid grid-cols-2 gap-2">
                                <Button onClick={() => handleRecordAttempt('home', true)} disabled={!homeSelection || gameIsDecided}><Goal className="mr-2 h-4 w-4" />Gol</Button>
                                <Button onClick={() => handleRecordAttempt('home', false)} disabled={!homeSelection || gameIsDecided} variant="outline"><Shield className="mr-2 h-4 w-4" />Atajado</Button>
                            </div>
                        </div>

                        {/* Away Team Shooter */}
                        <div className="space-y-3 p-4 border rounded-lg">
                            <h4 className="font-medium text-center">{awayTeamName}</h4>
                            <PlayerSelector team="away" onSelect={setAwaySelection} disabled={gameIsDecided} existingAttempts={shootout.awayAttempts} />
                            <div className="grid grid-cols-2 gap-2">
                                <Button onClick={() => handleRecordAttempt('away', true)} disabled={!awaySelection || gameIsDecided}><Goal className="mr-2 h-4 w-4" />Gol</Button>
                                <Button onClick={() => handleRecordAttempt('away', false)} disabled={!awaySelection || gameIsDecided} variant="outline"><Shield className="mr-2 h-4 w-4" />Atajado</Button>
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <h4 className="font-medium text-muted-foreground">Tiros de {homeTeamName}</h4>
                        {shootout.homeAttempts.length > 0 ? shootout.homeAttempts.map(a => <ShootoutAttemptRow key={a.id} attempt={a} />) : <p className="text-sm text-muted-foreground italic">Sin tiros registrados.</p>}
                    </div>
                     <div className="space-y-2">
                        <h4 className="font-medium text-muted-foreground">Tiros de {awayTeamName}</h4>
                        {shootout.awayAttempts.length > 0 ? shootout.awayAttempts.map(a => <ShootoutAttemptRow key={a.id} attempt={a} />) : <p className="text-sm text-muted-foreground italic">Sin tiros registrados.</p>}
                    </div>
                </div>

                <div className="pt-4 flex flex-col items-center gap-4">
                    {gameIsDecided && <p className="text-lg font-bold text-green-500 animate-pulse">¡El partido está decidido!</p>}
                    <Button onClick={handleFinishShootout} size="lg">
                        <Flag className="mr-2 h-5 w-5" />Finalizar Tanda de Penales
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
