import { describe, it, expect } from "vitest";
import { marcasDaRodada, quadrasFeitasDe, progressoDe } from "./quadras";
import type { Marca } from "./quadras";
import type { Territorio } from "./types";

function quadrado(lng: number, lat: number): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + 1, lat],
        [lng + 1, lat + 1],
        [lng, lat],
      ],
    ],
  };
}

function territorio(ids: string[], progresso_desde: string | null = null): Territorio {
  return {
    id: "t1",
    numero: "6",
    nome: null,
    limites: {
      type: "FeatureCollection",
      features: ids.map((id, i) => ({
        type: "Feature",
        properties: { id },
        geometry: quadrado(-46 + i, -23),
      })),
    },
    ativo: true,
    progresso_desde,
    created_at: "",
  };
}

const marca = (quadra_id: string, data: string, saida_id = "s1"): Marca => ({
  saida_id,
  territorio_id: "t1",
  quadra_id,
  data,
});

describe("marcasDaRodada", () => {
  it("conta tudo quando a rodada nunca foi zerada", () => {
    const t = territorio(["a", "b"]);
    const marcas = [marca("a", "2026-01-10"), marca("b", "2026-07-12")];
    expect(marcasDaRodada(t, marcas)).toHaveLength(2);
  });

  it("descarta as marcas anteriores à linha de corte", () => {
    const t = territorio(["a", "b"], "2026-07-01");
    const marcas = [marca("a", "2026-06-28"), marca("b", "2026-07-12")];
    expect(marcasDaRodada(t, marcas).map((m) => m.quadra_id)).toEqual(["b"]);
  });

  it("mantém a marca do próprio dia em que a rodada começou", () => {
    const t = territorio(["a"], "2026-07-12");
    expect(marcasDaRodada(t, [marca("a", "2026-07-12")])).toHaveLength(1);
  });

  it("ignora marcas de outro território", () => {
    const t = territorio(["a"]);
    const deOutro: Marca = { ...marca("a", "2026-07-12"), territorio_id: "t2" };
    expect(marcasDaRodada(t, [deOutro])).toEqual([]);
  });
});

describe("quadrasFeitasDe", () => {
  it("conta uma vez só a quadra trabalhada em duas saídas", () => {
    const t = territorio(["a", "b"]);
    const marcas = [marca("a", "2026-07-12", "s1"), marca("a", "2026-07-15", "s2")];
    expect(quadrasFeitasDe(t, marcas)).toEqual(new Set(["a"]));
  });

  it("descarta a marca órfã de uma quadra que foi apagada do desenho", () => {
    const t = territorio(["a"]);
    const marcas = [marca("a", "2026-07-12"), marca("quadra-apagada", "2026-07-12")];
    expect(quadrasFeitasDe(t, marcas)).toEqual(new Set(["a"]));
  });
});

describe("progressoDe", () => {
  it("mostra as quadras feitas sobre o total do território", () => {
    const t = territorio(["a", "b", "c"]);
    expect(progressoDe(t, [marca("a", "2026-07-12")])).toEqual({
      feitas: 1,
      total: 3,
      concluido: false,
    });
  });

  it("é concluído quando todas as quadras foram feitas", () => {
    const t = territorio(["a", "b"]);
    const marcas = [marca("a", "2026-07-12"), marca("b", "2026-07-12")];
    expect(progressoDe(t, marcas)).toEqual({ feitas: 2, total: 2, concluido: true });
  });

  it("volta a zero depois de a rodada ser zerada, sem apagar as marcas antigas", () => {
    const marcas = [marca("a", "2026-07-12"), marca("b", "2026-07-12")];
    const zerado = territorio(["a", "b"], "2026-07-13");
    expect(progressoDe(zerado, marcas)).toEqual({
      feitas: 0,
      total: 2,
      concluido: false,
    });
  });

  it("a quadra órfã não infla o total nem o feito", () => {
    const t = territorio(["a", "b"]);
    const marcas = [marca("a", "2026-07-12"), marca("sumiu", "2026-07-12")];
    expect(progressoDe(t, marcas)).toEqual({ feitas: 1, total: 2, concluido: false });
  });

  it("território sem limites não tem progresso nem fica concluído", () => {
    const semLimites: Territorio = { ...territorio([]), limites: null };
    expect(progressoDe(semLimites, [])).toEqual({
      feitas: 0,
      total: 0,
      concluido: false,
    });
  });
});
