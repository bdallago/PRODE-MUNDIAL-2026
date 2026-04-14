const fs = require('fs');

const text = `México vs. Sudáfrica – Estadio Ciudad de México -Jueves 11/06 - 16.00hs
Corea del Sur vs. República Checa – Estadio Guadalajara - Jueves 11/06 - 23.00hs
Canadá vs. Bosnia – Toronto Stadium - Viernes 12/06 - 16.00hs
Qatar vs. Suiza – San Francisco Bay Area Stadium - Sábado 13/06 - 16.00hs
Brasil vs. Marruecos – Nueva York / Nueva Jersey Stadium - Sábado 13/06 - 19.00hs
Haití vs. Escocia – Boston Stadium - Sábado 13/06 - 22.00hs
Estados Unidos vs. Paraguay – Los Angeles Stadium - Viernes 12/06 - 22.00hs
Australia vs. Turquía – BC Place Vancouver - Sábado 13/06 - 01.00hs
Alemania vs. Curazao – Houston Stadium - Domingo 14/06 - 14.00hs
Costa de Marfil vs. Ecuador – Philadelphia Stadium - Domingo 14/06 - 20.00hs
Países Bajos vs. Japón – Dallas Stadium - Domingo 14/06 - 17.00hs
Suecia vs. Túnez – Estadio Monterrey - Domingo 14/06 -  23.00hs
Bélgica vs. Egipto – Seattle Stadium - Lunes 15/06 - 16.00hs
Irán vs. Nueva Zelanda – Los Ángeles Stadium - Lunes 15/06 - 22.00hs
España vs. Cabo Verde – Atlanta Stadium - Lunes 15/06 - 13.00hs
Arabia Saudita vs. Uruguay – Miami Stadium - Lunes 15/06 - 19.00hs
Francia vs. Senegal – New York / New Jersey Stadium - Martes 16/06 - 16.00hs
Irak vs. Noruega – Boston Stadium - Martes 16/06 - 19.00hs
Austria vs. Jordania – San Francisco Bay Area Stadium - Martes 16/06 - 01.00hs
Argentina vs. Argelia – Kansas City Stadium - Martes 16/06 - 22.00hs
Portugal vs. República Democrática del Congo – Houston Stadium - Miércoles 17/06 - 14.00hs
Uzbekistán vs. Colombia – Estadio Ciudad de México - Miércoles 17/06 - 23.00hs
Inglaterra vs. Croacia – Dallas Stadium - Miércoles 17/06 - 17.00hs
Ghana vs. Panamá – Toronto Stadium - Miércoles 17/06 - 20.00hs
República Checa vs. Sudáfrica – Atlanta Stadium - Jueves 18/06 - 13.00hs
México vs. Corea del Sur – Estadio Guadalajara - Jueves 18/06 - 22.00hs
Suiza vs. Bosnia – Los Angeles Stadium - Jueves 18/06 - 16.00hs
Canadá vs. Qatar – BC Place Vancouver - Jueves 18/06 - 19.00hs
Escocia vs. Marruecos – Boston Stadium - Viernes 19/06 - 19.00hs
Brasil vs. Haití – Philadelphia Stadium - Viernes 19/06 - 22.00hs
Turquía  vs. Paraguay – San Francisco Bay Area Stadium - Viernes 19/06 - 01.00hs
Estados Unidos vs. Australia – Seattle Stadium - Viernes 19/06 - 16.00hs
Alemania vs. Costa de Marfil – Toronto Stadium - Sábado 20/06 - 17.00hs
Curazao vs. Ecuador – Kansas City Stadium - Sábado 20/06 - 21.00hs
Japón vs. Túnez – Estadio Monterrey - Sábado 20/06 - 01.00hs
Países Bajos vs. Suecia – Houston Stadium - Sábado 20/06 - 14.00hs
Bélgica vs. Irán – Los Angeles Stadium - Domingo 21/06 - 16.00hs
Egipto vs. Nueva Zelanda – BC Place Vancouver - Domingo 21/06 - 22.00hs
España vs. Arabia Saudita – Atlanta Stadium - Domingo 21/06 - 13.00hs
Cabo Verde vs. Uruguay – Miami Stadium - Domingo 21/06 - 19.00hs
Francia vs. Irak – Philadelphia Stadium - Lunes 22/06 - 18.00hs
Noruega vs. Senegal – New York / New Jersey Stadium - Lunes 22/06 - 21.00hs
Argentina vs. Austria – Dallas Stadium - Lunes 22/06 - 14.00hs
Jordania vs. Argelia – San Francisco Bay Area Stadium - Martes 23/06 - 00.00hs
Portugal vs. Uzbekistán – Houston Stadium - Martes 23/06 - 14.00hs
República Democrática del Congo vs. Colombia – Estadio Guadalajara - Martes 23/06 - 23.00hs
Inglaterra vs. Ghana – Boston Stadium - Martes 23/06 - 17.00hs
Croacia vs. Panamá – Toronto Stadium - Martes 23/06 - 20.00hs
República Checa vs. México – Estadio Ciudad de México - Miércoles 24/06 - 22.00hs
Sudáfrica vs. Corea del Sur – Estadio Monterrey - Miércoles 24/06 - 22.00hs
Suiza vs. Canadá – BC Place Vancouver - Miércoles 24/06 - 16.00hs
Bosnia vs. Qatar – Seattle Stadium - Miércoles 24/06 - 16.00hs
Escocia vs. Brasil – Miami Stadium - Miércoles 24/06 - 19.00hs
Marruecos vs. Haití – Atlanta Stadium - Miércoles 24/06 - 19.00hs
Turquía vs. Estados Unidos – Los Angeles Stadium - Jueves 25/06 - 23.00hs
Paraguay vs. Australia – San Francisco Bay Area Stadium - Jueves 25/06 - 23.00hs
Ecuador vs. Alemania – New York / New Jersey Stadium - Jueves 25/06 - 17.00hs
Curazao vs. Costa de Marfil – Philadelphia Stadium - Jueves 25/06 - 17.00hs
Túnez vs. Países Bajos – Dallas Stadium - Jueves 25/06 - 20.00hs
Japón vs. Suecia  – Kansas City Stadium - Jueves 25/06 - 20.00hs
Nueva Zelanda vs. Bélgica – BC Place Vanvouver - Sábado 27/06 - 00.00hs
Egipto vs. Irán – Seattle Stadium - Sábado 27/06 - 00.00hs
Uruguay vs. España – Estadio Guadalajara - Viernes 26/06 - 21.00hs
Cabo Verde vs. Arabia Saudita – Houston Stadium - Viernes 26/06 - 21.00hs
Noruega vs. Francia – Boston Stadium - Viernes 26/06 -16.00hs
Senegal vs. Irak – Toronto Stadium - Viernes 26/06 - 16.00hs
Jordania vs. Argentina – Dallas Stadium - Sábado 27/06 - 23.00hs
Argelia vs. Austria – Kansas City Stadium - Sábado 27/06 - 23.00hs
Colombia vs. Portugal – Miami Stadium - Sábado 27/06 - 20.30hs
República Democrática del Congo vs. Uzbekistán – Atlanta Stadium - Sábado 27/06 - 20.30hs
Panamá vs. Inglaterra – New York / New Jersey Stadium - Sábado 27/06 - 18.00hs
Croacia vs. Ghana – Philadelphia Stadium - Sábado 27/06 - 18.00hs`;

const GROUPS = {
  A: ["México", "Sudáfrica", "Corea del Sur", "República Checa"],
  B: ["Canadá", "Bosnia y Herzegovina", "Qatar", "Suiza"],
  C: ["Brasil", "Marruecos", "Haití", "Escocia"],
  D: ["Estados Unidos", "Paraguay", "Australia", "Turquía"],
  E: ["Alemania", "Curazao", "Costa de Marfil", "Ecuador"],
  F: ["Países Bajos", "Japón", "Suecia", "Túnez"],
  G: ["Bélgica", "Egipto", "Irán", "Nueva Zelanda"],
  H: ["España", "Cabo Verde", "Arabia Saudita", "Uruguay"],
  I: ["Francia", "Senegal", "Irak", "Noruega"],
  J: ["Argentina", "Argelia", "Austria", "Jordania"],
  K: ["Portugal", "Rep. Dem. Congo", "Uzbekistán", "Colombia"],
  L: ["Inglaterra", "Croacia", "Ghana", "Panamá"]
};

const aliases = {
  "Bosnia": "Bosnia y Herzegovina",
  "República Democrática del Congo": "Rep. Dem. Congo"
};

const getGroup = (team) => {
  const t = aliases[team] || team;
  for (const [g, teams] of Object.entries(GROUPS)) {
    if (teams.includes(t)) return g;
  }
  return null;
};

const lines = text.trim().split('\n');
const matches = [];

lines.forEach((line, index) => {
  const parts = line.split('–');
  if (parts.length < 2) return;
  
  const teamsPart = parts[0].trim();
  const restPart = parts.slice(1).join('–').trim();
  
  const [homeRaw, awayRaw] = teamsPart.split('vs.');
  const home = aliases[homeRaw.trim()] || homeRaw.trim();
  const away = aliases[awayRaw.trim()] || awayRaw.trim();
  
  const restTokens = restPart.split('-');
  let timeRaw = restTokens[restTokens.length - 1].trim();
  let dateRaw = restTokens[restTokens.length - 2].trim();
  
  let time = timeRaw.replace('hs', '').replace('.', ':').trim();
  if (time.length === 4) time = '0' + time;
  
  const dateParts = dateRaw.split(' ');
  const dayMonth = dateParts[dateParts.length - 1];
  const [day, month] = dayMonth.split('/');
  const date = `${parseInt(day)} de junio`;
  
  const group = getGroup(home);
  
  matches.push({
    id: `${group}-${index+1}`,
    group,
    home,
    away,
    date,
    time
  });
});

fs.writeFileSync('matches.json', JSON.stringify(matches, null, 2));
