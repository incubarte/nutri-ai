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

  // Get semifinal paths for finals
  const finalistPaths = useMemo(() => {
    if (currentMatch.playoffType !== 'final') return null;
    if (!currentMatch.homeTeamId || !currentMatch.awayTeamId) return null;

    // Find the semifinals for this category
    const semifinals = tournament.matches?.filter(m =>
      m.categoryId === currentMatch.categoryId &&
      m.phase === 'playoffs' &&
      m.playoffType === 'semifinal'
    ) || [];

    console.log('[FINAL DEBUG] Semifinals found:', semifinals.length);
    console.log('[FINAL DEBUG] Home team ID:', currentMatch.homeTeamId);
    console.log('[FINAL DEBUG] Away team ID:', currentMatch.awayTeamId);

    // Find which semifinal each team won
    const getTeamPath = (teamId: string, teamLabel: string) => {
      console.log(`[FINAL DEBUG] Looking for ${teamLabel} team (${teamId}) in semifinals...`);

      const semifinal = semifinals.find(sf =>
        sf.homeTeamId === teamId || sf.awayTeamId === teamId
      );

      console.log(`[FINAL DEBUG] ${teamLabel} semifinal found:`, semifinal ? 'YES' : 'NO');
      console.log(`[FINAL DEBUG] ${teamLabel} semifinal has summary:`, semifinal?.summary ? 'YES' : 'NO');

      if (!semifinal) return null;

      // If no summary yet, show placeholder
      if (!semifinal.summary) {
        const wasHome = semifinal.homeTeamId === teamId;
        const opponentId = wasHome ? semifinal.awayTeamId : semifinal.homeTeamId;
        const opponent = tournament.teams.find(t => t.id === opponentId);

        return {
          score: '- - -',
          opponent: opponent?.name || 'Equipo',
          won: false
        };
      }

      const homeGoals = semifinal.summary.statsByPeriod?.reduce((sum, p) => sum + (p.stats.goals.home?.length || 0), 0) || 0;
      const awayGoals = semifinal.summary.statsByPeriod?.reduce((sum, p) => sum + (p.stats.goals.away?.length || 0), 0) || 0;

      const wasHome = semifinal.homeTeamId === teamId;
      const opponentId = wasHome ? semifinal.awayTeamId : semifinal.homeTeamId;
      const opponent = tournament.teams.find(t => t.id === opponentId);

      return {
        score: wasHome ? `${homeGoals} - ${awayGoals}` : `${awayGoals} - ${homeGoals}`,
        opponent: opponent?.name || 'Equipo',
        won: wasHome ? homeGoals > awayGoals : awayGoals > homeGoals
      };
    };

    const homePath = getTeamPath(currentMatch.homeTeamId, 'HOME');
    const awayPath = getTeamPath(currentMatch.awayTeamId, 'AWAY');

    console.log('[FINAL DEBUG] Home path:', homePath);
    console.log('[FINAL DEBUG] Away path:', awayPath);

    return {
      home: homePath,
      away: awayPath
    };
  }, [tournament, currentMatch]);

  // Get all semifinal results for third place match
  const semifinalResults = useMemo(() => {
    if (currentMatch.playoffType !== '3er-puesto') return null;

    const semifinals = tournament.matches?.filter(m =>
      m.categoryId === currentMatch.categoryId &&
      m.phase === 'playoffs' &&
      m.playoffType === 'semifinal'
    ) || [];

    return semifinals.map(sf => {
      const homeTeam = tournament.teams.find(t => t.id === sf.homeTeamId);
      const awayTeam = tournament.teams.find(t => t.id === sf.awayTeamId);

      let homeGoals = 0;
      let awayGoals = 0;
      let winner: 'home' | 'away' | null = null;

      if (sf.summary) {
        homeGoals = sf.summary.statsByPeriod?.reduce((sum, p) => sum + (p.stats.goals.home?.length || 0), 0) || 0;
        awayGoals = sf.summary.statsByPeriod?.reduce((sum, p) => sum + (p.stats.goals.away?.length || 0), 0) || 0;

        if (homeGoals > awayGoals) winner = 'home';
        else if (awayGoals > homeGoals) winner = 'away';
      }

      return {
        homeTeam,
        awayTeam,
        homeGoals,
        awayGoals,
        winner,
        hasSummary: !!sf.summary,
        // Check if these teams are playing in current match (losers)
        homeIsPlaying: sf.homeTeamId === currentMatch.homeTeamId || sf.homeTeamId === currentMatch.awayTeamId,
        awayIsPlaying: sf.awayTeamId === currentMatch.homeTeamId || sf.awayTeamId === currentMatch.awayTeamId
      };
    });
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

  console.log('[PLAYOFF DEBUG] playoffType:', currentMatch.playoffType);

  const isFinal = currentMatch.playoffType === 'final';
  const isThirdPlace = currentMatch.playoffType === '3er-puesto';

  return (
    <div className="w-[150%] h-full flex flex-col gap-6 px-1 py-2 -mx-[25%]">
      {/* Title with Glow */}
      <div className="text-center mb-4">
        <h1
          className={`text-9xl font-black tracking-widest ${isFinal ? 'text-amber-400' : 'text-orange-400'}`}
          style={{
            textShadow: isFinal
              ? `
                0 0 15px rgba(251, 191, 36, 1),
                0 0 30px rgba(251, 191, 36, 0.8),
                0 0 45px rgba(251, 191, 36, 0.6),
                0 0 60px rgba(251, 191, 36, 0.4),
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
              : `
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
          {isFinal ? 'FINAL' : isThirdPlace ? '3er PUESTO' : 'SEMIFINAL'}
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

          {/* Right: Previous Matchups or Path to Final or Semifinal Results */}
          <div className="bg-card/70 border-2 border-border rounded-lg p-8 flex flex-col">
            <h3 className={`text-4xl font-bold mb-6 text-center border-b pb-4 ${isFinal ? 'border-amber-500/50 text-amber-400' : 'border-border text-foreground/90'}`}>
              {isFinal ? 'Camino a la Final' : isThirdPlace ? 'Semifinales' : 'Enfrentamientos Previos'}
            </h3>

            {isThirdPlace ? (
              /* Semifinal Results for Third Place Match */
              <div className="flex-1 flex flex-col justify-center space-y-6">
                {semifinalResults && semifinalResults.length > 0 ? (
                  semifinalResults.map((sf, idx) => (
                    <div key={idx} className="rounded-lg p-6 border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-transparent">
                      <h4 className="text-2xl font-bold text-orange-400 mb-4 text-center">Semifinal {idx + 1}</h4>
                      {sf.homeTeam && sf.awayTeam ? (
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 font-bold">
                          <div className="flex items-center justify-end gap-3">
                            <span
                              className={`truncate text-3xl text-right ${sf.homeIsPlaying ? 'text-orange-400' : ''}`}
                              title={sf.homeTeam.name}
                            >
                              {sf.homeTeam.name}
                            </span>
                            <div className="w-10 flex-shrink-0">
                              {sf.winner === 'home' && <Trophy className="h-10 w-10 text-yellow-500" />}
                            </div>
                          </div>
                          <span className="text-5xl text-white font-bold whitespace-nowrap flex-shrink-0">
                            {sf.hasSummary ? `${sf.homeGoals} - ${sf.awayGoals}` : '- - -'}
                          </span>
                          <div className="flex items-center justify-start gap-3">
                            <div className="w-10 flex-shrink-0">
                              {sf.winner === 'away' && <Trophy className="h-10 w-10 text-yellow-500" />}
                            </div>
                            <span
                              className={`truncate text-3xl text-left ${sf.awayIsPlaying ? 'text-orange-400' : ''}`}
                              title={sf.awayTeam.name}
                            >
                              {sf.awayTeam.name}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-foreground/70">Equipos no definidos</div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="flex-1 flex items-center justify-center text-foreground/70 text-2xl text-center px-6">
                    No se encontraron semifinales
                  </div>
                )}
              </div>
            ) : isFinal ? (
              /* Path to Final for each team */
              <div className="flex-1 flex flex-col justify-center space-y-8">
                {/* Home Team Path */}
                {finalistPaths?.home && (
                  <div className="rounded-lg p-6 border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
                    <h4 className="text-3xl font-bold text-amber-400 mb-4 text-center">{homeTeam.name}</h4>
                    {/* Semifinal Result */}
                    <div className="flex items-center justify-between bg-card/50 rounded px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xl text-foreground/80">Semifinal vs</span>
                        <span className="text-2xl font-semibold text-amber-300">{finalistPaths.home.opponent}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-4xl font-bold text-white">{finalistPaths.home.score}</span>
                        {finalistPaths.home.won && <Trophy className="h-10 w-10 text-amber-400" />}
                      </div>
                    </div>
                  </div>
                )}

                {/* Away Team Path */}
                {finalistPaths?.away && (
                  <div className="rounded-lg p-6 border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent">
                    <h4 className="text-3xl font-bold text-amber-400 mb-4 text-center">{awayTeam.name}</h4>
                    {/* Semifinal Result */}
                    <div className="flex items-center justify-between bg-card/50 rounded px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xl text-foreground/80">Semifinal vs</span>
                        <span className="text-2xl font-semibold text-amber-300">{finalistPaths.away.opponent}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-4xl font-bold text-white">{finalistPaths.away.score}</span>
                        {finalistPaths.away.won && <Trophy className="h-10 w-10 text-amber-400" />}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Previous Matchups for Semifinals */
              previousMatchups.length > 0 ? (
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
              )
            )}
          </div>
        </div>
    </div>
  );
}
