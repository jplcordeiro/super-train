import { describe, it, expect } from "vitest";
import { relatorioDoMes, type Marca } from "./quadras";
import type { Territorio } from "./types";

function quadrado(lng: number, lat: number, lado = 1): GeoJSON.Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + lado, lat],
        [lng + lado, lat + lado],
        [lng, lat + lado],
        [lng, lat],
      ],
    ],
  };
}

function colecao(
  ...quadras: [string, GeoJSON.Polygon][]
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: quadras.map(([id, geometry]) => ({
      type: "Feature",
      properties: { id },
      geometry,
    })),
  };
}

function territorio(numero: string, ...ids: string[]): Territorio {
  return {
    id: `t${numero}`,
    numero,
    nome: null,
    limites: colecao(
      ...ids.map((id, i): [string, GeoJSON.Polygon] => [id, quadrado(-46 - i, -23)]),
    ),
    ativo: true,
    progresso_desde: null,
    created_at: "",
  };
}

function marca(territorio_id: string, quadra_id: string, data: string): Marca {
  return {
    saida_id: `s-${territorio_id}-${quadra_id}-${data}`,
    territorio_id,
    quadra_id,
    data,
    local: null,
    publicador_id: null,
  };
}

const julho = { ano: 2026, mes: 7 };

describe("relatorioDoMes", () => {
  it("mês sem marcas: linhas vazia e totais zero", () => {
    const t = territorio("12", "qa", "qb");
    expect(relatorioDoMes(julho, [t], [])).toEqual({
      linhas: [],
      totalQuadrasNoMes: 0,
      totalConcluidos: 0,
    });
  });

  it("ignora marca órfã (quadra que não existe mais no desenho)", () => {
    const t = territorio("12", "qa");
    const r = relatorioDoMes(julho, [t], [marca("t12", "qZ", "2026-07-05")]);
    expect(r.linhas).toEqual([]);
    expect(r.totalQuadrasNoMes).toBe(0);
  });

  it("conta a mesma quadra marcada em duas saídas do mês uma vez só", () => {
    const t = territorio("12", "qa", "qb");
    const r = relatorioDoMes(julho, [t], [
      marca("t12", "qa", "2026-07-03"),
      marca("t12", "qa", "2026-07-20"),
    ]);
    expect(r.linhas[0].feitasNoMes).toBe(1);
    expect(r.totalQuadrasNoMes).toBe(1);
  });

  it("marca concluidoNoMes quando a rodada fecha dentro do mês", () => {
    const t = territorio("12", "qa", "qb");
    const r = relatorioDoMes(julho, [t], [
      marca("t12", "qa", "2026-07-03"),
      marca("t12", "qb", "2026-07-10"),
    ]);
    expect(r.linhas[0]).toMatchObject({
      feitasNoMes: 2,
      total: 2,
      concluidoNoMes: true,
    });
    expect(r.totalConcluidos).toBe(1);
  });

  it("não conta como concluído no mês quando a última quadra fechou em outro mês", () => {
    const t = territorio("12", "qa", "qb");
    const marcas = [marca("t12", "qa", "2026-07-03"), marca("t12", "qb", "2026-08-02")];
    const r = relatorioDoMes(julho, [t], marcas);
    expect(r.linhas[0]).toMatchObject({ feitasNoMes: 1, concluidoNoMes: false });
    expect(r.totalConcluidos).toBe(0);
  });

  it("preserva a ordem de entrada e omite territórios sem avanço no mês", () => {
    const t5 = territorio("5", "qa");
    const t6 = territorio("6", "qa");
    const t7 = territorio("7", "qa");
    const r = relatorioDoMes(julho, [t5, t6, t7], [
      marca("t5", "qa", "2026-07-01"),
      marca("t7", "qa", "2026-07-09"),
    ]);
    expect(r.linhas.map((l) => l.territorio.numero)).toEqual(["5", "7"]);
  });
});
