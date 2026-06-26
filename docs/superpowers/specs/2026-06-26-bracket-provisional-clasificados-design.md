# Vista provisional de 16avos: clasificados en su slot (estilo Google)

Fecha: 2026-06-26
Estado: Aprobado (diseño), pendiente plan de implementación

## Problema

La pestaña "Fase eliminatoria" de las predicciones, mientras la fase de grupos
no está 100% cerrada, muestra una vista provisional con 16 tarjetas de 16avos.
Hoy esa vista se arma desde un array hardcodeado paralelo (`R32_SCHEDULE` en
`KnockoutBracket.tsx`) que tiene algunos equipos sueltos pre-cargados y mergea la
API por coincidencia de horario/nombre.

Queremos que se vea como el cuadro de Google: **cada equipo ya clasificado
aparece en su slot correcto aunque su rival sea "Por definir"** (ej. Argentina,
Costa de Marfil, Australia, México, Alemania, Suiza), y los slots sin clasificado
definido muestran "Por definir" en ambos lados. Hay que mantener las 16 tarjetas
con su fecha/hora ART.

Regla observada en Google: un equipo se ubica en su slot **solo cuando su
posición exacta (1° o 2° de grupo) está bloqueada**. Por eso aparece Argentina
(ya 1ª del grupo J, aunque J siga abierto) pero NO Francia/España/Colombia
(clasificadas pero sin tener aún asegurado el puesto exacto).

## Estado de datos relevante (Firebase `results/actual`)

- `groups`: orden provisional de los 12 grupos (de `sync-standings`).
- `standings`: stats por equipo por grupo.
- `finishedGroups`: grupos con todos sus partidos jugados (hoy A–F).
- `qualifiedTeams`: equipos con `description === "Round of 32"` según la API
  (dice QUIÉN clasificó, no en qué POSICIÓN).
- `bracketMatchups`: cruces R32 sembrados por `sync-knockouts` (hoy solo R32-13).
- `bracketKickoffs`: horario por slot publicado por la API.

Piezas de código existentes que se reutilizan:

- `src/lib/bracket/seedTable.ts` → `R32_FIXED_SEEDS`: mapea cada slot R32 a su
  posición fija de grupo (ej. `R32-1`→`1A`, `R32-13`→`2A`). Validado contra la
  API (R32-13 = 2A = Sudáfrica, coincide con el cruce real Sudáfrica–Canadá).
- `src/lib/bracket/tree.ts` → `BRACKET_TREE` (16 slots R32 con `fixedSeed`).
- `placeFixtures.ts::resolveSeed` (lógica de resolver "1A" → nombre via standings).

## Decisión: Enfoque 1 (data-driven) + acople de syncs

### A. Vista provisional data-driven

Reescribir la rama `!groupStageFinished` de `KnockoutBracket.tsx` para renderizar
los 16 slots de `BRACKET_TREE` (round R32), en vez del array `R32_SCHEDULE`.

Para cada slot R32:

1. **Lado fijo (el clasificado conocido):** resolver `R32_FIXED_SEEDS[slot.id]`
   (ej. `"1A"`) contra `standings`/`groups`, pero mostrar el nombre **solo si esa
   posición está bloqueada**. Posición bloqueada =
   - el grupo está en `finishedGroups`, **o**
   - el seed está en el override `LOCKED_OPEN_SEEDS` (ver C).

   Si no está bloqueada → "Por definir".

2. **Rival:** si `bracketMatchups[slot.id]` existe (la API ya publicó el cruce),
   usar el equipo que NO es el lado fijo como rival. Si no, "Por definir".

3. **Fecha/hora:** `bracketKickoffs[slot.id]` si existe; si no, fallback de una
   tabla estática de fechas por slot id (`R32_KICKOFF_FALLBACK`). Cuando la API
   publica el kickoff real, pisa al fallback.

Se elimina el array `R32_SCHEDULE` y la lógica de merge por horario/nombre.

### B. Acople de syncs (cron)

En `app/api/cron/sync-standings/route.ts`, después de `syncStandings()` y del
`recalculatePoints()` actual, llamar a `syncKnockouts()`:

```
syncStandings()        // groups/standings/finishedGroups/qualifiedTeams
  → recalculatePoints() // SE MANTIENE por seguridad (decisión del usuario)
  → syncKnockouts()     // lee standings fresco, siembra cruces, escribe
                        // bracketMatchups/kickoffs y recalcula de nuevo
```

- El cron ya corre cada 30 min, así que el bracket se mantiene al día solo en las
  6 tandas de cierre de grupos restantes — sin disparar `sync-knockouts` a mano.
- `recalculatePoints()` queda DOS veces (una en el route, otra dentro de
  `syncKnockouts`). Es intencional por seguridad por ahora; no se optimiza.

### C. Único hardcode: Argentina

```ts
// Posiciones exactas ya bloqueadas en grupos que aún no cerraron.
const LOCKED_OPEN_SEEDS = new Set<string>(["1J"]); // Argentina 1ª de J
```

- Es el único equipo que aseguró su puesto exacto antes de que su grupo cierre.
- El resto de grupos abiertos no tiene 1°/2° definido todavía; se resuelven solos
  cuando juegan su último partido y entran en `finishedGroups`.
- Cuando J cierre, este override se vuelve redundante y se puede borrar.

## Trabajo manual recurrente posterior

- Prácticamente cero. El único caso a mantener a mano es `LOCKED_OPEN_SEEDS`
  (hoy = Argentina), y solo si algún otro equipo asegurara su puesto exacto antes
  del cierre de su grupo. Los syncs corren solos por cron.

## No incluido (YAGNI)

- Tema oscuro de las tarjetas (la app sigue en su estilo claro).
- Cambiar el texto "Por definir" por "A definir" ni el ícono de escudo.
- Cálculo automático de posiciones bloqueadas en grupos abiertos (sería el
  Enfoque 2; no se hace porque la API no expone la posición bloqueada y el único
  caso real es Argentina).

## Riesgos / validación

- `R32_FIXED_SEEDS` debe ser correcto para que cada clasificado caiga en el slot
  que le corresponde. Está marcado como "provisional" en el código pero R32-13 ya
  se validó contra la API. Al implementar, cross-checkear el resto contra los
  cruces que la API vaya publicando.
- El fallback de fechas por slot debe estar alineado con el calendario real para
  que no haya saltos cuando la API pise el horario.
- Verificar que `syncKnockouts()` agregado al cron no rompa el tiempo de ejecución
  del cron (dos llamadas a la API + dos recálculos).

## Testing

- Test unitario de la función de placement: dado `standings`, `finishedGroups`,
  `qualifiedTeams`, `bracketMatchups` y `LOCKED_OPEN_SEEDS`, devuelve los 16 slots
  con lado fijo/rival/kickoff esperados. Casos: grupo cerrado (ambos lados),
  grupo abierto con override (Argentina), grupo abierto sin override (ambos
  "Por definir" salvo rival que venga de la API), slot con cruce ya sembrado.
- Verificación manual en localhost contra las capturas de Google del 26/06.
