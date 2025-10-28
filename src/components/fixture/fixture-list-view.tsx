
"use client";

import React, { useState, useMemo } from 'react';
import { useGameState, getCategoryNameById } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { AddEditMatchDialog } from './add-edit-match-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import type { MatchData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function FixtureListView() {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { selectedTournamentId, tournaments } = state.config;
  
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [matchToEdit, setMatchToEdit] = useState<MatchData | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<MatchData | null>(null);

  const selectedTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const sortedMatches = useMemo(() => {
    if (!selectedTournament?.matches) return [];
    return [...selectedTournament.matches].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedTournament?.matches]);

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
      <h2 className="text-2xl font-bold">Lista de Partidos</h2>
      
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y Hora</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Equipo Local</TableHead>
              <TableHead>Equipo Visitante</TableHead>
              <TableHead>Jugadores</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMatches.length > 0 ? (
              sortedMatches.map(match => {
                const homeTeam = selectedTournament?.teams.find(t => t.id === match.homeTeamId);
                const awayTeam = selectedTournament?.teams.find(t => t.id === match.awayTeamId);
                return (
                  <TableRow key={match.id}>
                    <TableCell>{format(new Date(match.date), "dd/MM/yy HH:mm", { locale: es })}</TableCell>
                    <TableCell>{getCategoryNameById(match.categoryId, selectedTournament?.categories) || 'N/A'}</TableCell>
                    <TableCell>{homeTeam?.name || 'Equipo no encontrado'}</TableCell>
                    <TableCell>{awayTeam?.name || 'Equipo no encontrado'}</TableCell>
                    <TableCell>{match.playersPerTeam} vs {match.playersPerTeam}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditMatch(match)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setMatchToDelete(match)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No hay partidos programados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
                ¿Estás seguro de que quieres eliminar este partido? Esta acción no se puede deshacer.
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
