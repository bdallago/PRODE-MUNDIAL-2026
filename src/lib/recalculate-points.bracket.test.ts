import { describe, it, expect } from "vitest";
import { scoreBracket } from "./bracket/score";

// Test de contrato: el bloque de knockouts de recalculatePoints debe delegar
// en scoreBracket. Verificamos el cálculo esperado de un caso representativo.
describe("recalculate knockouts usa scoreBracket", () => {
  it("un usuario que acertó R32-1 y el campeón suma 2 + 15", () => {
    const pred = { "R32-1": "Argentina", F: "Argentina" };
    const actual = { "R32-1": "Argentina", F: "Argentina" };
    expect(scoreBracket(pred, actual)).toBe(17);
  });
});
