
"use client";

import React, { useState, useMemo } from 'react';
import { useGameState, type Team, type PlayerData, type ShootoutAttempt } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Swords, Check, X, Shield, Goal, Flag, Undo2 } from 'lucide-react';
import { Separator } from '../ui/separator';

const ShooterSelector = ({ onSelect, disabled }: { onSelect: (playerNumber: string) => void, disabled: boolean }) => {
    const [playerNumber, setPlayerNumber] = useState("");

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const num = e.target.value;
        if (/^\d*$/.test(num)) {
            setPlayerNumber(num);
            onSelect(num);
        }
    };
    
    // When a shot is recorded, the input should clear. This effect handles that.
    React.useEffect(() => {
        if (disabled) { // disabled becomes true when game is decided
            setPlayerNumber("");
        }
    }, [disabled]);


    return (
        <Input
            value={playerNumber}
            onChange={handleInputChange}
            placeholder="Ingresar Nº de Jugador"
            disabled={disabled}
            className="text-center text-lg h-12"
        />
    );
};

const ShootoutAttemptRow = ({ attempt }: { attempt: ShootoutAttempt }) => (
    <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
        <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground w-6 text-center">R{attempt.round}</span>
            <p className="text-sm font-medium">#{attempt.playerNumber} - {attempt.playerName || 'Jugador no listado'}</p>
        </div>
        {attempt.isGoal === true && <Check className="h-5 w-5 text-green-500" />}
        {attempt.isGoal === false && <X className="h-5 w-5 text-destructive" />}
    </div>
);


export const ShootoutControl = () => {
    const { state, dispatch } = useGameState();
    const { toast } = useToast();
    const { shootout, homeTeamName, awayTeamName, score } = state.live;
    const [homeSelection, setHomeSelection] = useState<string>("");
    const [awaySelection, setAwaySelection] = useState<string>("");

    const homeGoals = shootout?.homeAttempts.filter(a => a.isGoal).length || 0;
    const awayGoals = shootout?.awayAttempts.filter(a => a.isGoal).length || 0;
    const currentRound = Math.max(shootout?.homeAttempts.length || 0, shootout?.awayAttempts.length || 0) + 1;

    const gameIsDecided = useMemo(() => {
        if (!shootout) return false;
        // In regular rounds, the game is over if the difference is greater than rounds left for OTHER team
        if (currentRound <= shootout.rounds) {
            const homeRoundsLeft = shootout.rounds - shootout.homeAttempts.length;
            const awayRoundsLeft = shootout.rounds - shootout.awayAttempts.length;
            if (homeGoals > awayGoals + awayRoundsLeft) return true;
            if (awayGoals > homeGoals + homeRoundsLeft) return true;
        }
        // In sudden death, if rounds are complete and scores are not equal, game is over
        if (currentRound > shootout.rounds && shootout.homeAttempts.length === shootout.awayAttempts.length && homeGoals !== awayGoals) {
            return true;
        }
        return false;
    }, [shootout, homeGoals, awayGoals, currentRound]);

    const handleRecordAttempt = (team: Team, isGoal: boolean) => {
        const playerNumber = team === 'home' ? homeSelection : awaySelection;
        if (!playerNumber.trim()) {
            toast({ title: "Número de jugador requerido", description: `Por favor, ingresa el número del jugador para el equipo ${team === 'home' ? homeTeamName : awayTeamName}.`, variant: "destructive" });
            return;
        }

        const teamData = state.config.teams.find(t =>
            t.name === state.live[`${team}TeamName`] &&
            (t.subName || undefined) === (state.live[`${team}TeamSubName`] || undefined) &&
            t.category === state.config.selectedMatchCategory
        );
        const playerDetails = teamData?.players.find(p => p.number === playerNumber);

        dispatch({ type: 'RECORD_SHOOTOUT_ATTEMPT', payload: { team, playerId: playerDetails?.id || `unknown-${playerNumber}`, playerNumber, playerName: playerDetails?.name, isGoal } });

        if (team === 'home') setHomeSelection("");
        if (team === 'away') setAwaySelection("");
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
                            <ShooterSelector onSelect={setHomeSelection} disabled={gameIsDecided} />
                            <div className="grid grid-cols-2 gap-2">
                                <Button onClick={() => handleRecordAttempt('home', true)} disabled={!homeSelection || gameIsDecided}><Goal className="mr-2 h-4 w-4" />Gol</Button>
                                <Button onClick={() => handleRecordAttempt('home', false)} disabled={!homeSelection || gameIsDecided} variant="outline"><Shield className="mr-2 h-4 w-4" />Atajado</Button>
                            </div>
                        </div>

                        {/* Away Team Shooter */}
                        <div className="space-y-3 p-4 border rounded-lg">
                            <h4 className="font-medium text-center">{awayTeamName}</h4>
                            <ShooterSelector onSelect={setAwaySelection} disabled={gameIsDecided} />
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
