

"use client";

import React, { useMemo } from "react";
import { useGameState, formatTime, type Team, type GoalLog, type PenaltyLog, getCategoryNameById, getEndReasonText } from "@/contexts/game-state-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Goal, Siren, X, FileText, FileDown, Crosshair } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportGameSummaryPDF } from "@/lib/pdf-generator";

interface GameSummaryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const TeamSummaryColumn = ({ team, teamName, score, shots, goals, penalties }: { team: Team; teamName: string; score: number; shots: number; goals: GoalLog[]; penalties: PenaltyLog[] }) => (
  <div className="flex-1 space-y-4">
    <div className="text-center">
        <h3 className="text-2xl font-bold text-primary">{teamName} - <span className="text-accent">{score}</span></h3>
        <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Crosshair className="h-4 w-4" />
            <span>{shots} Tiros a Puerta</span>
        </p>
    </div>
    
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
          </Table>
        ) : <p className="text-sm text-muted-foreground">Sin goles registrados.</p>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl"><Siren className="h-5 w-5" />Penalidades</CardTitle>
      </CardHeader>
      <CardContent>
        {penalties.length > 0 ? (
           <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Jugador</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {penalties.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-semibold">#{p.playerNumber}</div>
                    <div className="text-xs text-muted-foreground">{p.playerName || '---'}</div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{formatTime(p.initialDuration * 100)}</TableCell>
                  <TableCell>
                     <div className="text-sm">{getEndReasonText(p.endReason)}</div>
                     {p.timeServed !== undefined && <div className="text-xs text-muted-foreground font-mono">({formatTime(p.timeServed * 100)})</div>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : <p className="text-sm text-muted-foreground">Sin penalidades registradas.</p>}
      </CardContent>
    </Card>
  </div>
);

export function GameSummaryDialog({ isOpen, onOpenChange }: GameSummaryDialogProps) {
  const { state } = useGameState();
  const { toast } = useToast();
  
  const homeGoals = useMemo(() => {
    if (!state.live.score) return [];
    return [...(state.live.score.homeGoals || [])].sort((a, b) => a.timestamp - b.timestamp);
  }, [state.live.score]);
  
  const awayGoals = useMemo(() => {
    if (!state.live.score) return [];
    return [...(state.live.score.awayGoals || [])].sort((a, b) => a.timestamp - b.timestamp);
  }, [state.live.score]);
  
  const homePenalties = useMemo(() => {
      if (!state.live.gameSummary.home) return [];
      return [...state.live.gameSummary.home.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp);
  }, [state.live.gameSummary.home]);

  const awayPenalties = useMemo(() => {
      if (!state.live.gameSummary.away) return [];
      return [...state.live.gameSummary.away.penalties].sort((a,b) => a.addTimestamp - b.addTimestamp);
  }, [state.live.gameSummary.away]);


  const escapeCsvCell = (cellData: any): string => {
    const stringData = String(cellData ?? '');
    if (stringData.includes(',') || stringData.includes('"') || stringData.includes('\n')) {
        return `"${stringData.replace(/"/g, '""')}"`;
    }
    return stringData;
  };

  const handleExportCSV = () => {
    const headers = ['Equipo', 'Tipo', 'Tiempo Juego', 'Periodo', '# Jugador', 'Nombre', '# Jugador 2', 'Nombre 2', 'Duración Pen.', 'Estado Pen.'];
    const rows: string[][] = [];

    homeGoals.forEach(g => rows.push([state.live.homeTeamName, 'Gol', formatTime(g.gameTime), g.periodText, g.scorer?.playerNumber || 'S/N', g.scorer?.playerName || '---', g.assist?.playerNumber || '', g.assist?.playerName || '', '', '']));
    awayGoals.forEach(g => rows.push([state.live.awayTeamName, 'Gol', formatTime(g.gameTime), g.periodText, g.scorer?.playerNumber || 'S/N', g.scorer?.playerName || '---', g.assist?.playerNumber || '', g.assist?.playerName || '', '', '']));
    homePenalties.forEach(p => rows.push([state.live.homeTeamName, 'Penalidad', formatTime(p.addGameTime), p.addPeriodText, p.playerNumber, p.playerName || '---', '', '', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason) ]));
    awayPenalties.forEach(p => rows.push([state.live.awayTeamName, 'Penalidad', formatTime(p.addGameTime), p.addPeriodText, p.playerNumber, p.playerName || '---', '', '', formatTime(p.initialDuration * 100), getEndReasonText(p.endReason) ]));

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.map(escapeCsvCell).join(','), ...rows.map(row => row.map(escapeCsvCell).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `resumen_partido_${state.live.homeTeamName}_vs_${state.live.awayTeamName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleExportPDF = () => {
    const filename = exportGameSummaryPDF(state);
    toast({
        title: "Resumen Descargado",
        description: `El archivo ${filename} se ha guardado.`,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-3xl">Resumen del Partido</DialogTitle>
          <DialogDescription>
            Un resumen completo de los goles y penalidades del partido actual.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow my-4 border-y py-4 pr-6 -mr-6">
          <div className="flex flex-col md:flex-row gap-6">
            <TeamSummaryColumn 
              team="home"
              teamName={state.live.homeTeamName}
              score={state.live.score.home}
              shots={state.live.score.homeShots}
              goals={homeGoals}
              penalties={homePenalties}
            />
            <Separator orientation="vertical" className="hidden md:block h-auto" />
            <Separator orientation="horizontal" className="block md:hidden" />
             <TeamSummaryColumn 
              team="away"
              teamName={state.live.awayTeamName}
              score={state.live.score.away}
              shots={state.live.score.awayShots}
              goals={awayGoals}
              penalties={awayPenalties}
            />
          </div>
        </ScrollArea>
        <DialogFooter className="flex-wrap">
          <div className="flex-grow flex justify-start gap-2">
            <Button type="button" variant="outline" onClick={handleExportCSV}><FileText className="mr-2 h-4 w-4" />Exportar a CSV</Button>
            <Button type="button" variant="outline" onClick={handleExportPDF}><FileDown className="mr-2 h-4 w-4" />Exportar a PDF</Button>
          </div>
          <DialogClose asChild>
            <Button type="button" variant="outline"><X className="mr-2 h-4 w-4" />Cerrar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
