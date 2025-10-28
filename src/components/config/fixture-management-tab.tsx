
"use client";

import React, { useState, useMemo } from 'react';
import { useGameState, getCategoryNameById } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { PlusCircle, Calendar as CalendarIcon, Edit, Trash2, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { addDays, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { AddEditMatchDialog } from './add-edit-match-dialog';
import { DefaultTeamLogo } from '@/components/teams/default-team-logo';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import type { MatchData, TeamData } from '@/types';
import { useToast } from '@/hooks/use-toast';

export function FixtureManagementTab() {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { selectedTournamentId, tournaments } = state.config;
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [matchToEdit, setMatchToEdit] = useState<MatchData | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<MatchData | null>(null);

  const selectedTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const matches = useMemo(() => {
    return selectedTournament?.matches || [];
  }, [selectedTournament]);

  const matchesOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return matches
      .filter(match => isSameDay(new Date(match.date), selectedDate))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches, selectedDate]);
  
  const getTeamById = (teamId: string): TeamData | undefined => {
    return selectedTournament?.teams.find(t => t.id === teamId);
  }
  
  const handleEditMatch = (match: MatchData) => {
    setMatchToEdit(match);
    setIsAddEditDialogOpen(true);
  };
  
  const handleDeleteMatch = () => {
    if (!matchToDelete || !selectedTournamentId) return;
    dispatch({ type: 'DELETE_MATCH_FROM_TOURNAMENT', payload: { tournamentId: selectedTournamentId, matchId: matchToDelete.id }});
    toast({ title: 'Partido Eliminado', description: 'El partido ha sido eliminado del fixture.' });
    setMatchToDelete(null);
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Fixture del Torneo</h2>
        <Button onClick={() => { setMatchToEdit(null); setIsAddEditDialogOpen(true); }}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Partido
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5" /> Calendario
                </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={es}
                    modifiers={{
                        hasMatch: matches.map(m => new Date(m.date))
                    }}
                    modifiersStyles={{
                        hasMatch: { fontWeight: 'bold', color: 'hsl(var(--accent))' }
                    }}
                />
            </CardContent>
        </Card>
        
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <List className="h-5 w-5" />
                    Partidos del {selectedDate ? format(selectedDate, "d 'de' MMMM", { locale: es }) : "día seleccionado"}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {matchesOnSelectedDate.length > 0 ? (
                    matchesOnSelectedDate.map(match => {
                        const homeTeam = getTeamById(match.homeTeamId);
                        const awayTeam = getTeamById(match.awayTeamId);
                        const categoryName = getCategoryNameById(match.categoryId, selectedTournament?.categories);

                        return (
                            <div key={match.id} className="p-3 border rounded-md bg-muted/50 flex justify-between items-center">
                               <div className="space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        {homeTeam ? <DefaultTeamLogo teamName={homeTeam.name} size="sm" /> : <div className="w-8 h-8 rounded-full bg-muted"></div>}
                                        <span className="font-semibold">{homeTeam?.name || 'Equipo no encontrado'}</span>
                                        <span className="text-muted-foreground mx-1">vs</span>
                                        <span className="font-semibold">{awayTeam?.name || 'Equipo no encontrado'}</span>
                                        {awayTeam ? <DefaultTeamLogo teamName={awayTeam.name} size="sm" /> : <div className="w-8 h-8 rounded-full bg-muted"></div>}
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-4 pl-10">
                                       <span>{format(new Date(match.date), 'HH:mm')} hs</span>
                                       <span>Cat: {categoryName || 'N/A'}</span>
                                       <span>{match.playersPerTeam} vs {match.playersPerTeam}</span>
                                    </div>
                               </div>
                               <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditMatch(match)}><Edit className="h-4 w-4"/></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setMatchToDelete(match)}><Trash2 className="h-4 w-4"/></Button>
                               </div>
                            </div>
                        )
                    })
                ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">No hay partidos programados para este día.</p>
                )}
            </CardContent>
        </Card>
      </div>

      <AddEditMatchDialog
        isOpen={isAddEditDialogOpen}
        onOpenChange={setIsAddEditDialogOpen}
        tournament={selectedTournament}
        matchToEdit={matchToEdit}
      />
      
       {matchToDelete && (
        <AlertDialog open={!!matchToDelete} onOpenChange={() => setMatchToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Eliminación</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que quieres eliminar este partido del fixture? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setMatchToDelete(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteMatch} className="bg-destructive hover:bg-destructive/90">
                Eliminar Partido
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

    </div>
  );
}
