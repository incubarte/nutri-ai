"use client";

import React, { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import type { Tournament, MatchData, TeamData, PlayoffBracketHighlightStyle } from '@/types';

interface PlayoffBracketPreviewProps {
  tournament: Tournament;
  currentMatch: MatchData;
  homeTeam: TeamData | undefined;
  awayTeam: TeamData | undefined;
  highlightStyle: PlayoffBracketHighlightStyle;
}

interface PreviousMatchup {
  homeScore: number;
  awayScore: number;
  date: string;
  phase: string;
}

export function PlayoffBracketPreview({
  tournament,
  currentMatch,
  homeTeam,
  awayTeam,
  highlightStyle
}: PlayoffBracketPreviewProps) {

  // Get standings positions for these teams (from clasificacion phase)
  const teamStandings = useMemo(() => {
    if (!homeTeam || !awayTeam || !currentMatch.categoryId) return null;

    // Get all matches from clasificacion phase for this category
    const clasificacionMatches = tournament.matches?.filter(m =>
      m.categoryId === currentMatch.categoryId &&
      m.phase === 'clasificacion' &&
      m.summary
    ) || [];

    // Calculate standings
    const standings = new Map<string, {
      teamId: string;
      teamName: string;
      played: number;
      won: number;
      drawn: number;
      lost: number;
      points: number;
    }>();

    // Initialize teams
    tournament.teams.filter(t => t.category === currentMatch.categoryId).forEach(team => {
      standings.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        points: 0
      });
    });

    // Process matches
    clasificacionMatches.forEach(match => {
      if (!match.homeTeamId || !match.awayTeamId || !match.summary) return;

      const homeGoals = match.summary.statsByPeriod?.reduce((sum, p) => sum + (p.stats.goals.home?.length || 0), 0) || 0;
      const awayGoals = match.summary.statsByPeriod?.reduce((sum, p) => sum + (p.stats.goals.away?.length || 0), 0) || 0;

      const homeData = standings.get(match.homeTeamId);
      const awayData = standings.get(match.awayTeamId);

      if (homeData && awayData) {
        homeData.played++;
        awayData.played++;

        if (homeGoals > awayGoals) {
          homeData.won++;
          homeData.points += 3;
          awayData.lost++;
        } else if (awayGoals > homeGoals) {
          awayData.won++;
          awayData.points += 3;
          homeData.lost++;
        } else {
          homeData.drawn++;
          awayData.drawn++;
          homeData.points += 1;
          awayData.points += 1;
        }
      }
    });

    // Sort and get positions - FULL TABLE
    const sortedStandings = Array.from(standings.values())
      .sort((a, b) => b.points - a.points || b.won - a.won);

    // Get standings with actual positions
    const homeStanding = sortedStandings.find(s => s.teamId === currentMatch.homeTeamId);
    const awayStanding = sortedStandings.find(s => s.teamId === currentMatch.awayTeamId);

    // Calculate real positions in the full table
    const homePosition = homeStanding ? sortedStandings.findIndex(s => s.teamId === currentMatch.homeTeamId) + 1 : 0;
    const awayPosition = awayStanding ? sortedStandings.findIndex(s => s.teamId === currentMatch.awayTeamId) + 1 : 0;

    return {
      home: homeStanding ? { ...homeStanding, position: homePosition } : undefined,
      away: awayStanding ? { ...awayStanding, position: awayPosition } : undefined
    };
  }, [tournament, currentMatch, homeTeam, awayTeam]);

  // Get previous matchups between these teams
  const previousMatchups = useMemo(() => {
    if (!currentMatch.homeTeamId || !currentMatch.awayTeamId) return [];

    const matchups: PreviousMatchup[] = [];

    tournament.matches?.forEach(match => {
      if (!match.summary) return;

      const isDirectMatchup = (
        (match.homeTeamId === currentMatch.homeTeamId && match.awayTeamId === currentMatch.awayTeamId) ||
        (match.homeTeamId === currentMatch.awayTeamId && match.awayTeamId === currentMatch.homeTeamId)
      );

      if (isDirectMatchup && match.id !== currentMatch.id && match.phase === 'clasificacion') {
        const homeGoals = match.summary.statsByPeriod?.reduce((sum, p) => sum + (p.stats.goals.home?.length || 0), 0) || 0;
        const awayGoals = match.summary.statsByPeriod?.reduce((sum, p) => sum + (p.stats.goals.away?.length || 0), 0) || 0;

        // Adjust scores based on which team is home/away in CURRENT match
        const isSwapped = match.homeTeamId !== currentMatch.homeTeamId;

        matchups.push({
          homeScore: isSwapped ? awayGoals : homeGoals,
          awayScore: isSwapped ? homeGoals : awayGoals,
          date: new Date(match.date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }),
          phase: 'Clasificación'
        });
      }
    });

    return matchups;
  }, [tournament, currentMatch]);

  // Calculate head-to-head record
  const headToHead = useMemo(() => {
    const homeWins = previousMatchups.filter(m => m.homeScore > m.awayScore).length;
    const awayWins = previousMatchups.filter(m => m.awayScore > m.homeScore).length;
    const draws = previousMatchups.filter(m => m.homeScore === m.awayScore).length;

    return { homeWins, awayWins, draws };
  }, [previousMatchups]);

  // Get other semifinal match (if exists)
  const otherSemifinal = useMemo(() => {
    if (currentMatch.playoffType !== 'semifinal') return null;

    const otherSemi = tournament.matches?.find(m =>
      m.categoryId === currentMatch.categoryId &&
      m.phase === 'playoffs' &&
      m.playoffType === 'semifinal' &&
      m.id !== currentMatch.id
    );

    if (!otherSemi) return null;

    const otherHomeTeam = tournament.teams.find(t => t.id === otherSemi.homeTeamId);
    const otherAwayTeam = tournament.teams.find(t => t.id === otherSemi.awayTeamId);

    // Check if match is finished
    let winner: string | null = null;
    if (otherSemi.summary) {
      const homeGoals = otherSemi.summary.statsByPeriod?.reduce((sum, p) => sum + (p.stats.goals.home?.length || 0), 0) || 0;
      const awayGoals = otherSemi.summary.statsByPeriod?.reduce((sum, p) => sum + (p.stats.goals.away?.length || 0), 0) || 0;
      if (homeGoals > awayGoals) winner = otherHomeTeam?.name || 'Equipo';
      else if (awayGoals > homeGoals) winner = otherAwayTeam?.name || 'Equipo';
    }

    return {
      homeTeamName: otherHomeTeam?.name || 'TBD',
      awayTeamName: otherAwayTeam?.name || 'TBD',
      winner,
      isFinished: !!otherSemi.summary
    };
  }, [tournament, currentMatch]);

  // Determine matchup labels
  const currentMatchupLabel = currentMatch.playoffMatchup || 'Semifinal 1';
  const otherMatchupLabel = otherSemifinal ? 'Semifinal 2' : '';

  // Highlight styles
  const getHighlightClass = () => {
    switch (highlightStyle) {
      case 'pulse':
        return 'animate-pulse ring-4 ring-yellow-500/50';
      case 'border':
        return 'border-4 border-yellow-400';
      case 'glow':
        return 'shadow-[0_0_30px_rgba(250,204,21,0.6)]';
      case 'trophy':
        return 'ring-4 ring-yellow-500/50';
      default:
        return '';
    }
  };

  if (!homeTeam || !awayTeam) return null;

  return (
    <div className="w-[150%] h-full flex flex-col gap-6 px-1 py-2 -mx-[25%]">
      {/* Semifinal Title with Glow */}
      <div className="text-center mb-4">
        <h1
          className="text-9xl font-black tracking-widest text-orange-400"
          style={{
            textShadow: `
              0 0 8px rgba(251, 146, 60, 0.7),
              0 0 15px rgba(251, 146, 60, 0.5),
              0 0 25px rgba(251, 146, 60, 0.3),
              4px 4px 0 rgba(0, 0, 0, 1),
              -4px -4px 0 rgba(0, 0, 0, 1),
              4px -4px 0 rgba(0, 0, 0, 1),
              -4px 4px 0 rgba(0, 0, 0, 1),
              5px 5px 0 rgba(0, 0, 0, 0.9),
              -5px -5px 0 rgba(0, 0, 0, 0.9),
              5px -5px 0 rgba(0, 0, 0, 0.9),
              -5px 5px 0 rgba(0, 0, 0, 0.9),
              6px 6px 0 rgba(0, 0, 0, 0.7),
              -6px -6px 0 rgba(0, 0, 0, 0.7),
              6px -6px 0 rgba(0, 0, 0, 0.7),
              -6px 6px 0 rgba(0, 0, 0, 0.7)
            `
          }}
        >
          SEMIFINAL
        </h1>
      </div>

      {/* Main section: Table (left) + Previous Matchups (right) */}
      <div className="grid grid-cols-2 gap-2 flex-1">
        {/* Left: Simplified Standings Table */}
        <div className="bg-card/70 border-2 border-border rounded-lg p-8 flex flex-col">
          <h3 className="text-4xl font-bold mb-6 text-center border-b border-border pb-4 text-foreground/90">
            Fase de Clasificación
          </h3>
            {teamStandings && (
              <div className="flex-1 flex items-center justify-center">
                <table className="w-full text-3xl">
                  <thead>
                    <tr className="text-left border-b-2 border-border text-foreground/80">
                      <th className="py-5 px-4 text-3xl">Pos</th>
                      <th className="py-5 px-4 text-3xl">Equipo</th>
                      <th className="text-center py-5 px-4 text-3xl">Dif</th>
                      <th className="text-center py-5 px-4 text-3xl">Pts</th>
                    </tr>
                  </thead>
                  <tbody className="text-3xl">
                    {[teamStandings.home, teamStandings.away]
                      .filter(Boolean)
                      .sort((a, b) => ((a as any)?.position || 0) - ((b as any)?.position || 0))
                      .map((standing) => {
                        if (!standing) return null;
                        // Calculate goal difference from matches
                        const goalsFor = tournament.matches
                          ?.filter(m => m.summary && m.phase === 'clasificacion' &&
                            (m.homeTeamId === standing.teamId || m.awayTeamId === standing.teamId))
                          .reduce((sum, m) => {
                            const isHome = m.homeTeamId === standing.teamId;
                            const goals = m.summary!.statsByPeriod?.reduce((g, p) =>
                              g + (isHome ? (p.stats.goals.home?.length || 0) : (p.stats.goals.away?.length || 0)), 0) || 0;
                            return sum + goals;
                          }, 0) || 0;
                        const goalsAgainst = tournament.matches
                          ?.filter(m => m.summary && m.phase === 'clasificacion' &&
                            (m.homeTeamId === standing.teamId || m.awayTeamId === standing.teamId))
                          .reduce((sum, m) => {
                            const isHome = m.homeTeamId === standing.teamId;
                            const goals = m.summary!.statsByPeriod?.reduce((g, p) =>
                              g + (isHome ? (p.stats.goals.away?.length || 0) : (p.stats.goals.home?.length || 0)), 0) || 0;
                            return sum + goals;
                          }, 0) || 0;
                        const goalDiff = goalsFor - goalsAgainst;

                        return (
                          <tr key={standing.teamId} className="border-b border-border/30 hover:bg-accent/20">
                            <td className="py-5 px-4 font-bold text-6xl">{(standing as any).position}°</td>
                            <td className="py-5 px-4 font-semibold truncate max-w-[450px] text-4xl" title={standing.teamName}>
                              {standing.teamName}
                            </td>
                            <td className="text-center py-5 px-4 font-medium text-4xl">
                              <span className={goalDiff > 0 ? 'text-green-500' : goalDiff < 0 ? 'text-red-500' : ''}>
                                {goalDiff > 0 ? '+' : ''}{goalDiff}
                              </span>
                            </td>
                            <td className="text-center py-5 px-4 font-bold text-5xl text-white">{standing.points}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right: Previous Matchups */}
          <div className="bg-card/70 border-2 border-border rounded-lg p-8 flex flex-col">
            <h3 className="text-4xl font-bold mb-6 text-center border-b border-border pb-4 text-foreground/90">
              Enfrentamientos Previos
            </h3>
            {previousMatchups.length > 0 ? (
              <div className="flex-1 flex flex-col justify-center space-y-4">
                {previousMatchups.map((matchup, idx) => {
                  const homeWon = matchup.homeScore > matchup.awayScore;
                  const awayWon = matchup.awayScore > matchup.homeScore;

                  return (
                    <div key={idx} className="rounded-lg p-6 text-xl border border-border/30">
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 font-bold">
                        <div className="flex items-center justify-end gap-3">
                          <div className="w-10 flex-shrink-0">
                            {homeWon && <Trophy className="h-10 w-10 text-yellow-500" />}
                          </div>
                          <span className="truncate text-4xl text-right" title={homeTeam.name}>
                            {homeTeam.name}
                          </span>
                        </div>
                        <span className="text-6xl text-white font-bold whitespace-nowrap flex-shrink-0">
                          {matchup.homeScore} - {matchup.awayScore}
                        </span>
                        <div className="flex items-center justify-start gap-3">
                          <span className="truncate text-4xl text-left" title={awayTeam.name}>
                            {awayTeam.name}
                          </span>
                          <div className="w-10 flex-shrink-0">
                            {awayWon && <Trophy className="h-10 w-10 text-yellow-500" />}
                          </div>
                        </div>
                      </div>
                      <div className="text-2xl text-foreground/70 text-center mt-2">
                        {matchup.date} · {matchup.phase}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-foreground/70 text-2xl text-center px-6">
                No hay enfrentamientos previos entre estos equipos en la fase regular
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
