"use client";

import React from 'react';
import Image from 'next/image';
import { Shield, User } from 'lucide-react';
import type { TeamData, Tournament } from '@/types';
import { getPresentPlayersSorted, getPlayerPhotoUrl } from '@/lib/roster-utils';

interface RosterPresentationProps {
  homeTeam: TeamData;
  awayTeam: TeamData;
  tournament: Tournament;
  homePresentPlayerIds: string[];
  awayPresentPlayerIds: string[];
  showHomeTeam: boolean; // Whether home team meets photo criteria
  showAwayTeam: boolean; // Whether away team meets photo criteria
}

export function RosterPresentation({
  homeTeam,
  awayTeam,
  tournament,
  homePresentPlayerIds,
  awayPresentPlayerIds,
  showHomeTeam,
  showAwayTeam,
}: RosterPresentationProps) {
  const homePlayers = showHomeTeam ? getPresentPlayersSorted(homeTeam, homePresentPlayerIds) : [];
  const awayPlayers = showAwayTeam ? getPresentPlayersSorted(awayTeam, awayPresentPlayerIds) : [];

  console.log('[RosterPresentation]', {
    homeTeam: homeTeam.name,
    homePresentPlayerIds,
    homePlayersFiltered: homePlayers.length,
    awayTeam: awayTeam.name,
    awayPresentPlayerIds,
    awayPlayersFiltered: awayPlayers.length,
  });

  return (
    <>
      {/* Home Team Roster - Top Left Corner */}
      {showHomeTeam && (
        <div className="absolute left-4 top-4 w-[54%] max-w-[720px] z-20 bg-card/80 backdrop-blur-md rounded-lg p-4 border border-primary/30 shadow-xl">
          <div className="grid grid-cols-4 gap-2 max-h-[calc(100vh-120px)] overflow-y-auto roster-scroll">
            {homePlayers.map((player, index) => (
              <PlayerCard
                key={player.id}
                player={player}
                teamName={homeTeam.name}
                tournamentId={tournament.id}
                index={index}
                side="home"
              />
            ))}
          </div>
        </div>
      )}

      {/* Away Team Roster - Bottom Right Corner */}
      {showAwayTeam && (
        <div className="absolute right-4 bottom-4 w-[54%] max-w-[720px] z-20 bg-card/80 backdrop-blur-md rounded-lg p-4 border border-primary/30 shadow-xl">
          <div className="grid grid-cols-4 gap-2 max-h-[calc(100vh-120px)] overflow-y-auto roster-scroll">
            {awayPlayers.map((player, index) => (
              <PlayerCard
                key={player.id}
                player={player}
                teamName={awayTeam.name}
                tournamentId={tournament.id}
                index={index}
                side="away"
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

interface PlayerCardProps {
  player: any;
  teamName: string;
  tournamentId: string;
  index: number;
  side: 'home' | 'away';
}

function PlayerCard({ player, teamName, tournamentId, index, side }: PlayerCardProps) {
  const photoUrl = getPlayerPhotoUrl(player, teamName, tournamentId);

  return (
    <div
      className="relative aspect-[3/4] rounded-lg overflow-hidden border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 shadow-lg"
      style={{
        animation: `slideIn${side === 'home' ? 'Left' : 'Right'} 0.5s ease-out ${index * 0.05}s backwards`,
      }}
    >
      {/* Photo or placeholder */}
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={player.name}
          fill
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {player.type === 'goalkeeper' ? (
            <Shield className="h-8 w-8 text-primary/30" />
          ) : (
            <User className="h-8 w-8 text-primary/30" />
          )}
        </div>
      )}

      {/* Player info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2">
        <p className="text-white font-bold text-2xl">
          #{player.number || 'S/N'}
        </p>
        <p className="text-white/90 text-lg font-semibold truncate">
          {player.name}
        </p>
      </div>
    </div>
  );
}
