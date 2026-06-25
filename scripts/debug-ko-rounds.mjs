import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf-8').split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')];
  })
);

const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=1&season=2026`, {
  headers: { 'x-apisports-key': env.FOOTBALL_API_KEY },
});
const json = await res.json();
const fixtures = json.response ?? [];

// Show all distinct round names
const rounds = [...new Set(fixtures.map(f => f.league?.round))].sort();
console.log('=== All round names ===');
rounds.forEach(r => console.log(' ', JSON.stringify(r)));

// Show fixtures that look like KO (not "Group" rounds)
const koFixtures = fixtures.filter(f => !f.league?.round?.toLowerCase().includes('group'));
console.log(`\n=== Non-group fixtures (${koFixtures.length}) ===`);
koFixtures.forEach(f => {
  console.log(`  [${f.league?.round}] ${f.teams?.home?.name} vs ${f.teams?.away?.name} — ${f.fixture?.status?.short}`);
});
