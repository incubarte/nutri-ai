
"use client";

import React, { useState, useMemo } from 'react';
import { useGameState, getCategoryNameById } from '@/contexts/game-state-context';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { addMonths, subMonths, format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { AddEditMatchDialog } from './add-edit-match-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import type { MatchData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '@/lib/utils';
import { FixtureMatchSummaryDialog } from './fixture-match-summary-dialog';

export function FixtureCalendarView() {
  const { state, dispatch } = useGameState();
  const { toast } = useToast();
  const { selectedTournamentId, tournaments } = state.config;
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [isAddEditDialogOpen, setIsAddEditDialogOpen] = useState(false);
  const [matchToEdit, setMatchToEdit] = useState<MatchData | null>(null);
  const [matchToDelete, setMatchToDelete] = useState<MatchData | null>(null);
  const [dialogSelectedDate, setDialogSelectedDate] = useState<Date | undefined>(undefined);
  const [matchToShowSummary, setMatchToShowSummary] = useState<MatchData | null>(null);

  const selectedTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  const matches = useMemo(() => {
    return selectedTournament?.matches || [];
  }, [selectedTournament]);

  const handleDayClick = (day: Date) => {
    setDialogSelectedDate(day);
    setMatchToEdit(null);
    setIsAddEditDialogOpen(true);
  };

  const handleEditMatch = (match: MatchData) => {
    setMatchToEdit(match);
    setDialogSelectedDate(new Date(match.date));
    setIsAddEditDialogOpen(true);
  };
  
  const handleDeleteMatch = () => {
    if (!matchToDelete || !selectedTournamentId) return;
    dispatch({ type: 'DELETE_MATCH_FROM_TOURNAMENT', payload: { tournamentId: selectedTournamentId, matchId: matchToDelete.id }});
    toast({ title: 'Partido Eliminado', description: 'El partido ha sido eliminado del fixture.' });
    setMatchToDelete(null);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const daysOfWeek = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center px-2">
        <h3 className="text-xl font-semibold">{format(currentMonth, "MMMM yyyy", { locale: es })}</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 border-t border-l">
        {daysOfWeek.map(day => (
          <div key={day} className="text-center font-bold p-2 border-b border-r bg-muted/50">{day}</div>
        ))}
        {days.map(day => {
          const matchesForDay = matches
            .filter(match => isSameDay(new Date(match.date), day))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          return (
            <div 
              key={day.toString()} 
              className={cn(
                "relative p-2 border-b border-r min-h-[120px] flex flex-col", 
                !isSameMonth(day, currentMonth) && "bg-muted/20 text-muted-foreground"
              )}
            >
              <div 
                className={cn("font-medium cursor-pointer hover:text-blue-500", isSameDay(day, new Date()) && "text-blue-500 font-bold")}
                onClick={() => handleDayClick(day)}
              >
                {format(day, "d")}
              </div>
              <ScrollArea className="flex-grow mt-1">
                <div className="space-y-1 pr-1">
                  {matchesForDay.map(match => {
                    const homeTeam = selectedTournament?.teams.find(t => t.id === match.homeTeamId);
                    const awayTeam = selectedTournament?.teams.find(t => t.id === match.awayTeamId);
                    const hasSummary = !!match.summary;

                    return (
                      <div key={match.id} className="text-xs p-1 rounded-md bg-background/50 border border-border/50">
                        <div className="font-semibold truncate">{format(new Date(match.date), 'HH:mm')} - {homeTeam?.name || '?'} vs {awayTeam?.name || '?'}</div>
                        <div className="flex justify-between items-center text-muted-foreground">
                            <span className="truncate">Cat: {getCategoryNameById(match.categoryId, selectedTournament?.categories) || 'N/A'}</span>
                             <div className="flex gap-0">
                                {hasSummary && (
                                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setMatchToShowSummary(match)}>
                                        <FileText className="h-3 w-3 text-blue-400" />
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleEditMatch(match)}><Edit className="h-3 w-3"/></Button>
                                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => setMatchToDelete(match)}><Trash2 className="h-3 w-3"/></Button>
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      <AddEditMatchDialog
        isOpen={isAddEditDialogOpen}
        onOpenChange={setIsAddEditDialogOpen}
        tournament={selectedTournament}
        matchToEdit={matchToEdit}
        selectedDate={dialogSelectedDate}
      />
      
      {matchToShowSummary && (
        <FixtureMatchSummaryDialog
          isOpen={!!matchToShowSummary}
          onOpenChange={() => setMatchToShowSummary(null)}
          match={matchToShowSummary}
          tournament={selectedTournament}
        />
      )}

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
