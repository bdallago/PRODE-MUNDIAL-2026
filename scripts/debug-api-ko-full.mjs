import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(root, '.env'), 'utf-8').split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')];
  })
);
const KEY = env.FOOTBALL_API_KEY;

// 1. Standings — check for "status" or "description" field (qualified/eliminated)
const sRes = await fetch('https://v3.football.api-sports.io/standings?league=1&season=2026', {
  headers: { 'x-apisports-key': KEY }
});
const sJson = await sRes.json();
const allStandings = sJson.response?.[0]?.league?.standings ?? [];
console.log('=== STANDINGS: status/description per team ===');
for (const group of allStandings) {
  const groupName = group[0]?.group;
  for (const entry of group) {
    if (entry.description || entry.status) {
      console.log(`  [${groupName}] ${entry.team.name}: description="${entry.description}" status="${entry.status}"`);
    }
  }
}

// 2. All R32 fixtures — including scheduled (NS) ones
const fRes = await fetch('https://v3.football.api-sports.io/fixtures?league=1&season=2026&round=Round of 32', {
  headers: { 'x-apisports-key': KEY }
});
const fJson = await fRes.json();
const r32Fixtures = fJson.response ?? [];
console.log(`\n=== Round of 32 fixtures (${r32Fixtures.length}) ===`);
for (const f of r32Fixtures) {
  const home = f.teams?.home?.name ?? '?';
  const away = f.teams?.away?.name ?? '?';
  const status = f.fixture?.status?.short;
  const ts = f.fixture?.timestamp;
  const date = ts ? new Date(ts * 1000).toISOString() : 'no date';
  console.log(`  ${home} vs ${away} | ${status} | ${date}`);
}
