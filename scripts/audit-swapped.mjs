// Detecta partidos donde la API tiene home/away invertido respecto a data.ts
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const envContent = readFileSync(join(root, '.env'), 'utf-8');
const env = Object.fromEntries(
  envContent.split('\n').filter(l => l.includes('=')).map(l => {
    const [k, ...v] = l.split('=');
    return [k.trim(), v.join('=').trim().replace(/^"|"$/g, '')];
  })
);
Object.assign(process.env, env);

const { MATCHES } = await import('../src/data.ts');

const TEAM_MAP = (await import('../src/lib/sportsApi.ts')).default ?? null;

// Copiar TEAM_MAP de sportsApi.ts manualmente ya que no se exporta
const MAP = {
  "Mexico": "México", "South Africa": "Sudáfrica", "South Korea": "Corea del Sur",
  "Czech Republic": "República Checa", "Czechia": "República Checa",
  "Canada": "Canadá", "Bosnia and Herzegovina": "Bosnia y Herzegovina",
  "Bosnia & Herzegovina": "Bosnia y Herzegovina", "Bosnia": "Bosnia y Herzegovina",
  "Qatar": "Qatar", "Switzerland": "Suiza", "Brazil": "Brasil",
  "Morocco": "Marruecos", "Haiti": "Haití", "Scotland": "Escocia",
  "United States": "Estados Unidos", "United States of America": "Estados Unidos",
  "USA": "Estados Unidos", "Paraguay": "Paraguay", "Australia": "Australia",
  "Turkey": "Turquía", "Türkiye": "Turquía", "Germany": "Alemania",
  "Curacao": "Curazao", "Curaçao": "Curazao", "Ivory Coast": "Costa de Marfil",
  "Côte d'Ivoire": "Costa de Marfil", "Ecuador": "Ecuador",
  "Netherlands": "Países Bajos", "Japan": "Japón", "Sweden": "Suecia",
  "Tunisia": "Túnez", "Belgium": "Bélgica", "Egypt": "Egipto",
  "Iran": "Irán", "New Zealand": "Nueva Zelanda", "Spain": "España",
  "Cape Verde": "Cabo Verde", "Cape Verde Islands": "Cabo Verde",
  "Saudi Arabia": "Arabia Saudita", "Uruguay": "Uruguay", "France": "Francia",
  "Senegal": "Senegal", "Iraq": "Irak", "Norway": "Noruega",
  "Argentina": "Argentina", "Algeria": "Argelia", "Austria": "Austria",
  "Jordan": "Jordania", "Portugal": "Portugal", "DR Congo": "Rep. Dem. Congo",
  "Congo DR": "Rep. Dem. Congo", "Democratic Republic of Congo": "Rep. Dem. Congo",
  "Uzbekistan": "Uzbekistán", "Colombia": "Colombia", "England": "Inglaterra",
  "Croatia": "Croacia", "Ghana": "Ghana", "Panama": "Panamá",
};

const API_BASE = process.env.FOOTBALL_API_BASE_URL || "https://v3.football.api-sports.io";
const API_KEY = process.env.FOOTBALL_API_KEY || "";
const LEAGUE = process.env.FOOTBALL_WORLD_CUP_LEAGUE_ID || "1";
const SEASON = process.env.FOOTBALL_WORLD_CUP_SEASON || "2026";

const res = await fetch(`${API_BASE}/fixtures?league=${LEAGUE}&season=${SEASON}`, {
  headers: { "x-apisports-key": API_KEY },
});
const json = await res.json();
const fixtures = json.response ?? [];

const DONE = new Set(["FT", "AET", "PEN"]);
const matchByTeams = Object.fromEntries(MATCHES.map(m => [`${m.home}|${m.away}`, m]));

let swapped = [];
let notFound = [];

for (const f of fixtures) {
  const status = f.fixture?.status?.short;
  if (!DONE.has(status)) continue;

  const homeApi = f.teams?.home?.name;
  const awayApi = f.teams?.away?.name;
  const home = MAP[homeApi] ?? homeApi;
  const away = MAP[awayApi] ?? awayApi;

  const direct = matchByTeams[`${home}|${away}`];
  const inverted = matchByTeams[`${away}|${home}`];

  if (!direct && inverted) {
    swapped.push({ id: inverted.id, apiHome: homeApi, apiAway: awayApi, goals: `${f.goals?.home}-${f.goals?.away}` });
  } else if (!direct && !inverted) {
    notFound.push({ homeApi, awayApi, home, away });
  }
}

// También chequear partidos futuros/pendientes
let swappedFuture = [];
let notFoundFuture = [];

for (const f of fixtures) {
  const status = f.fixture?.status?.short;
  if (DONE.has(status)) continue;

  const homeApi = f.teams?.home?.name;
  const awayApi = f.teams?.away?.name;
  const home = MAP[homeApi] ?? homeApi;
  const away = MAP[awayApi] ?? awayApi;

  const direct = matchByTeams[`${home}|${away}`];
  const inverted = matchByTeams[`${away}|${home}`];

  if (!direct && inverted) {
    swappedFuture.push({ id: inverted.id, apiHome: homeApi, apiAway: awayApi, status });
  } else if (!direct && !inverted) {
    notFoundFuture.push({ homeApi, awayApi, home, away, status });
  }
}

// Resultados finalizados
if (swapped.length === 0) {
  console.log('✅ No hay partidos FINALIZADOS con home/away invertido.');
} else {
  console.log(`\n⚠️  Partidos FINALIZADOS con home/away INVERTIDO (${swapped.length}):`);
  for (const s of swapped) {
    console.log(`  ${s.id}: API dice "${s.apiHome} vs ${s.apiAway}" [${s.goals}]`);
  }
}

if (notFound.length > 0) {
  console.log(`\n❓ Partidos FINALIZADOS NO encontrados en data.ts (${notFound.length}):`);
  for (const n of notFound) {
    console.log(`  API: "${n.homeApi}" vs "${n.awayApi}" → mapeado: "${n.home}" vs "${n.away}"`);
  }
}

// Partidos futuros/pendientes
if (swappedFuture.length === 0) {
  console.log('\n✅ No hay partidos FUTUROS con home/away invertido.');
} else {
  console.log(`\n⚠️  Partidos FUTUROS con home/away INVERTIDO (${swappedFuture.length}):`);
  for (const s of swappedFuture) {
    console.log(`  ${s.id} [${s.status}]: API dice "${s.apiHome} vs ${s.apiAway}"`);
  }
}

if (notFoundFuture.length > 0) {
  console.log(`\n❓ Partidos FUTUROS NO encontrados en data.ts (${notFoundFuture.length}):`);
  for (const n of notFoundFuture) {
    console.log(`  [${n.status}] API: "${n.homeApi}" vs "${n.awayApi}" → mapeado: "${n.home}" vs "${n.away}"`);
  }
}

process.exit(0);
