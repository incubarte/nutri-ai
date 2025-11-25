/**
 * Debug summary generation to see why voice events aren't adding shots
 */

const fs = require('fs');
const path = require('path');

const tournamentId = '8a422a4c-1953-4abd-acae-bf5cd358ef9c';
const matchId = 'c9919b78-f1ed-4452-be61-e0f091083d95';

// Read live.json
const live = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'tmp/new-storage/data/live.json'),
  'utf-8'
));

console.log('=== LIVE STATE ===');
console.log('Home team:', live.homeTeamName);
console.log('Home subName:', live.homeTeamSubName);
console.log('Away team:', live.awayTeamName);
console.log('Away subName:', live.awayTeamSubName);

// Read tournament
const teamsPath = path.join(
  __dirname,
  'tmp/new-storage/data/tournaments',
  tournamentId,
  'teams.json'
);
const teams = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

console.log('\n=== TEAMS IN TOURNAMENT ===');
teams.forEach(t => {
  console.log(`- ${t.name}${t.subName ? ' ' + t.subName : ''} (category: ${t.category})`);
  console.log(`  Players: ${t.players.length}`);
  if (t.players.length > 0) {
    console.log(`  Sample: #${t.players[0].number} ${t.players[0].name}`);
  }
});

// Read voice events
const voiceEventsPath = path.join(
  __dirname,
  'tmp/new-storage/data/tournaments',
  tournamentId,
  'voice-events',
  `${matchId}.json`
);
const voiceEvents = JSON.parse(fs.readFileSync(voiceEventsPath, 'utf-8'));

console.log('\n=== VOICE EVENTS ===');
console.log('Total events:', voiceEvents.length);
voiceEvents.forEach((e, i) => {
  console.log(`${i + 1}. ${e.data.team} #${e.data.playerNumber} (${e.data.teamName})`);
});

// Try to find home team in tournament
console.log('\n=== TEAM MATCHING ===');
const homeTeamMatch = teams.find(t =>
  t.name === live.homeTeamName &&
  (t.subName || undefined) === (live.homeTeamSubName || undefined)
);
console.log('Home team match:', homeTeamMatch ? 'FOUND' : 'NOT FOUND');
if (homeTeamMatch) {
  console.log('  Players count:', homeTeamMatch.players.length);
}

const awayTeamMatch = teams.find(t =>
  t.name === live.awayTeamName &&
  (t.subName || undefined) === (live.awayTeamSubName || undefined)
);
console.log('Away team match:', awayTeamMatch ? 'FOUND' : 'NOT FOUND');
if (awayTeamMatch) {
  console.log('  Players count:', awayTeamMatch.players.length);
}

// Check if voice event players exist in roster
console.log('\n=== PLAYER MATCHING ===');
if (homeTeamMatch) {
  const homeVoiceEvents = voiceEvents.filter(e => e.data.team === 'home');
  homeVoiceEvents.forEach(e => {
    const player = homeTeamMatch.players.find(p => p.number === e.data.playerNumber);
    console.log(`Home #${e.data.playerNumber}: ${player ? `FOUND (${player.name})` : 'NOT FOUND'}`);
  });
}

if (awayTeamMatch) {
  const awayVoiceEvents = voiceEvents.filter(e => e.data.team === 'away');
  awayVoiceEvents.forEach(e => {
    const player = awayTeamMatch.players.find(p => p.number === e.data.playerNumber);
    console.log(`Away #${e.data.playerNumber}: ${player ? `FOUND (${player.name})` : 'NOT FOUND'}`);
  });
}
