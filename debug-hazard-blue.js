const fs = require('fs');
const path = require('path');

const teamsPath = path.join(__dirname, 'tmp/new-storage/data/tournaments/8a422a4c-1953-4abd-acae-bf5cd358ef9c/teams.json');
const teamsData = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));

const hazardBlue = teamsData.teams.find(t => t.name === 'Hazard Blue' && t.subName === 'Blue');

console.log('=== HAZARD BLUE TEAM ===');
console.log('Found:', hazardBlue ? 'YES' : 'NO');

if (hazardBlue) {
  console.log('Total players in roster:', hazardBlue.players.length);
  console.log('\nPlayers:');
  hazardBlue.players.forEach((p, i) => {
    console.log(`${i + 1}. #${p.number || '--'} ${p.name} (${p.id})`);
  });
}

// Now check live attendance
const livePath = path.join(__dirname, 'tmp/new-storage/data/live.json');
const liveData = JSON.parse(fs.readFileSync(livePath, 'utf-8'));

console.log('\n=== ATTENDANCE (HOME) ===');
console.log('Players present:', liveData.attendance.home.length);

const attendanceIds = new Set(liveData.attendance.home.map(p => p.id));

console.log('\n=== MATCHING ===');
if (hazardBlue) {
  hazardBlue.players.forEach(p => {
    const isPresent = attendanceIds.has(p.id);
    console.log(`${isPresent ? '✓' : '✗'} #${p.number || '--'} ${p.name}`);
  });

  const present = hazardBlue.players.filter(p => attendanceIds.has(p.id)).length;
  const absent = hazardBlue.players.filter(p => !attendanceIds.has(p.id)).length;

  console.log(`\nSUMMARY: ${present} present, ${absent} absent`);
}
